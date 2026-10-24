import hashlib
import io
import math
import secrets
import re
import httpx
from datetime import timedelta, datetime, timezone
from pathlib import Path
from uuid import uuid4
from contextlib import asynccontextmanager

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Request,
    Response,
    UploadFile,
    File,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from PIL import Image, UnidentifiedImageError, ImageOps
from pwdlib import PasswordHash
from sqlalchemy import select, func, or_, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session as DBSession

from .core import settings, init_db, get_db, now
from .models import (
    User,
    Session,
    Listing,
    Favorite,
    Conversation,
    Message,
    CommunityPoint,
)
from .schemas import (
    Register,
    Login,
    Profile,
    PasswordChange,
    ListingInput,
    Availability,
    ConversationInput,
    MessageInput,
)

passwords = PasswordHash.recommended()
COOKIE = "verdeperto_session"
Db = Depends(get_db)
Image.MAX_IMAGE_PIXELS = 24_000_000


@asynccontextmanager
async def lifespan(app):
    init_db()
    yield


app = FastAPI(title="VerdePerto API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def browser_security(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        own_origin = str(request.base_url).rstrip("/")
        if origin and origin not in settings.cors_origins and origin != own_origin:
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": "Origem não autorizada."}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.path.startswith("/api/") and not request.url.path.startswith(
        "/api/media/"
    ):
        response.headers["Cache-Control"] = "no-store"
    return response


def fail(code, detail):
    raise HTTPException(code, detail)


def public_value(value):
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def public_user(user):
    # Whitelist explícita: nenhum schema público serializa email, senha ou sessão.
    return {
        k: public_value(getattr(user, k))
        for k in (
            "id",
            "name",
            "avatar_url",
            "bio",
            "city",
            "neighborhood",
            "created_at",
        )
    }


def private_user(user):
    return {**public_user(user), "email": user.email}


def current_user(request: Request, db: DBSession = Db):
    raw = request.cookies.get(COOKIE)
    if not raw:
        fail(401, "Entre na sua conta para continuar.")
    session = db.scalar(
        select(Session).where(
            Session.token_hash == hashlib.sha256(raw.encode()).hexdigest(),
            Session.expires_at > now(),
        )
    )
    if not session:
        fail(401, "Sua sessão expirou. Entre novamente.")
    return db.get(User, session.user_id)


Auth = Depends(current_user)


def new_session(response, db, user):
    raw = secrets.token_urlsafe(32)
    db.add(
        Session(
            user_id=user.id,
            token_hash=hashlib.sha256(raw.encode()).hexdigest(),
            expires_at=now() + timedelta(days=settings.session_days),
        )
    )
    db.commit()
    response.set_cookie(
        COOKIE,
        raw,
        httponly=True,
        secure=settings.environment == "production",
        samesite="lax",
        max_age=settings.session_days * 86400,
        path="/api",
    )


def listing_or_404(db, listing_id, owner=None):
    listing = db.get(Listing, listing_id)
    if not listing or listing.deleted_at:
        fail(404, "Oferta não encontrada.")
    if owner is not None and listing.owner_id != owner.id:
        fail(403, "Somente o anunciante pode alterar esta oferta.")
    return listing


def listing_data(listing, lat=None, lng=None):
    keys = (
        "id",
        "owner_id",
        "title",
        "description",
        "category",
        "quantity",
        "unit",
        "offer_type",
        "price",
        "exchange_for",
        "image_url",
        "city",
        "neighborhood",
        "public_latitude",
        "public_longitude",
        "status",
        "created_at",
        "updated_at",
    )
    data = {k: public_value(getattr(listing, k)) for k in keys}
    data["owner"] = public_user(listing.owner)
    data["distance_km"] = None
    if lat is not None and lng is not None:
        a, b = math.radians(lat), math.radians(listing.public_latitude)
        delta = math.radians(listing.public_longitude - lng)
        h = (
            math.sin((b - a) / 2) ** 2
            + math.cos(a) * math.cos(b) * math.sin(delta / 2) ** 2
        )
        data["distance_km"] = round(6371 * 2 * math.asin(min(1, math.sqrt(h))), 1)
    return data


@app.get("/api/health")
def health(db: DBSession = Db):
    db.execute(select(1))
    return {"status": "ok", "service": "VerdePerto"}


@app.post("/api/auth/register", status_code=201)
def register(body: Register, response: Response, db: DBSession = Db):
    user = User(
        **body.model_dump(exclude={"password", "email"}),
        email=str(body.email).lower(),
        password_hash=passwords.hash(body.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        fail(409, "Este e-mail já está cadastrado.")
    new_session(response, db, user)
    return private_user(user)


@app.post("/api/auth/login")
def login(body: Login, response: Response, db: DBSession = Db):
    user = db.scalar(select(User).where(User.email == str(body.email).lower()))
    # Executa uma verificação Argon2 mesmo para contas inexistentes.
    valid = passwords.verify(body.password, user.password_hash if user else DUMMY_HASH)
    if not user or not valid:
        fail(401, "E-mail ou senha incorretos.")
    db.execute(delete(Session).where(Session.expires_at <= now()))
    new_session(response, db, user)
    return private_user(user)


DUMMY_HASH = passwords.hash(secrets.token_urlsafe(20))


@app.post("/api/auth/logout", status_code=204)
def logout(request: Request, response: Response, db: DBSession = Db):
    raw = request.cookies.get(COOKIE, "")
    db.execute(
        delete(Session).where(
            Session.token_hash == hashlib.sha256(raw.encode()).hexdigest()
        )
    )
    db.commit()
    response.delete_cookie(COOKIE, path="/api")


@app.get("/api/auth/me")
@app.get("/api/users/me")
def me(user=Auth):
    return private_user(user)


@app.patch("/api/users/me")
def update_profile(body: Profile, user=Auth, db: DBSession = Db):
    for key, value in body.model_dump().items():
        setattr(user, key, value)
    db.commit()
    return private_user(user)


@app.post("/api/users/me/password")
def change_password(
    body: PasswordChange, response: Response, user=Auth, db: DBSession = Db
):
    if not passwords.verify(body.current_password, user.password_hash):
        fail(400, "Senha atual incorreta.")
    user.password_hash = passwords.hash(body.new_password)
    db.execute(delete(Session).where(Session.user_id == user.id))
    new_session(response, db, user)
    return {"detail": "Senha alterada. Outras sessões foram encerradas."}


@app.get("/api/users/me/listings")
def my_listings(user=Auth, db: DBSession = Db):
    return [
        listing_data(l)
        for l in db.scalars(
            select(Listing)
            .where(Listing.owner_id == user.id, Listing.deleted_at.is_(None))
            .order_by(Listing.created_at.desc())
        )
    ]


@app.get("/api/users/{user_id}")
def profile(user_id: int, db: DBSession = Db):
    user = db.get(User, user_id)
    if not user:
        fail(404, "Perfil não encontrado.")
    return public_user(user)


def search_listings(
    db,
    q,
    category,
    offer_type,
    status,
    city,
    sort,
    lat,
    lng,
    page,
    page_size,
    owner_id=None,
):
    statement = select(Listing).where(Listing.deleted_at.is_(None))
    if q:
        statement = statement.where(
            func.lower(Listing.title).contains(q.lower(), autoescape=True)
        )
    for field, value in (
        (Listing.category, category),
        (Listing.offer_type, offer_type),
        (Listing.status, status),
        (Listing.city, city),
        (Listing.owner_id, owner_id),
    ):
        if value:
            statement = statement.where(field == value)
    total = db.scalar(select(func.count()).select_from(statement.subquery()))
    if sort == "nearest" and lat is not None and lng is not None:
        # Distância equiretangular para ordenar a região; cálculo preciso apenas na página retornada.
        dx, dy = (
            Listing.public_latitude - lat,
            (Listing.public_longitude - lng) * math.cos(math.radians(lat)),
        )
        statement = statement.order_by(dx * dx + dy * dy, Listing.id.desc())
    else:
        statement = statement.order_by(Listing.created_at.desc(), Listing.id.desc())
    listings = db.scalars(statement.offset((page - 1) * page_size).limit(page_size))
    return {
        "items": [listing_data(l, lat, lng) for l in listings],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.get("/api/listings")
def listings(
    q: str = Query("", max_length=100),
    category: str | None = None,
    offer_type: str | None = None,
    status: str | None = "available",
    city: str | None = None,
    sort: str = "recent",
    lat: float | None = Query(None, ge=-90, le=90),
    lng: float | None = Query(None, ge=-180, le=180),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=100),
    owner_id: int | None = None,
    db: DBSession = Db,
):
    return search_listings(
        db,
        q,
        category,
        offer_type,
        status,
        city,
        sort,
        lat,
        lng,
        page,
        page_size,
        owner_id,
    )


@app.get("/api/map/listings")
def map_listings(
    category: str | None = None,
    offer_type: str | None = None,
    city: str | None = None,
    lat: float = Query(-19.93, ge=-90, le=90),
    lng: float = Query(-44.05, ge=-180, le=180),
    db: DBSession = Db,
):
    return search_listings(
        db, "", category, offer_type, "available", city, "nearest", lat, lng, 1, 100
    )


@app.get("/api/listings/{listing_id}")
def listing_detail(listing_id: int, db: DBSession = Db):
    return listing_data(listing_or_404(db, listing_id))


@app.post("/api/listings", status_code=201)
def create_listing(body: ListingInput, user=Auth, db: DBSession = Db):
    listing = Listing(**body.model_dump(), owner_id=user.id)
    db.add(listing)
    db.commit()
    return listing_data(listing)


@app.patch("/api/listings/{listing_id}")
def edit_listing(listing_id: int, body: ListingInput, user=Auth, db: DBSession = Db):
    listing = listing_or_404(db, listing_id, user)
    for key, value in body.model_dump().items():
        setattr(listing, key, value)
    db.commit()
    return listing_data(listing)


@app.patch("/api/listings/{listing_id}/availability")
def availability(listing_id: int, body: Availability, user=Auth, db: DBSession = Db):
    listing = listing_or_404(db, listing_id, user)
    listing.quantity = body.quantity
    listing.status = "completed" if body.quantity == 0 else body.status
    db.commit()
    return listing_data(listing)


@app.delete("/api/listings/{listing_id}", status_code=204)
def remove_listing(listing_id: int, user=Auth, db: DBSession = Db):
    listing = listing_or_404(db, listing_id, user)
    # Preserva o histórico das conversas sem manter a oferta na API pública.
    listing.deleted_at, listing.status = now(), "unavailable"
    db.execute(delete(Favorite).where(Favorite.listing_id == listing.id))
    db.commit()


@app.get("/api/favorites")
def favorites(user=Auth, db: DBSession = Db):
    rows = db.scalars(
        select(Listing)
        .join(Favorite)
        .where(Favorite.user_id == user.id, Listing.deleted_at.is_(None))
        .order_by(Favorite.id.desc())
    )
    return [listing_data(l) for l in rows]


@app.post("/api/favorites/{listing_id}", status_code=201)
def add_favorite(listing_id: int, user=Auth, db: DBSession = Db):
    listing_or_404(db, listing_id)
    favorite = db.scalar(
        select(Favorite).where(
            Favorite.user_id == user.id, Favorite.listing_id == listing_id
        )
    )
    if not favorite:
        db.add(Favorite(user_id=user.id, listing_id=listing_id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return {"saved": True}


@app.delete("/api/favorites/{listing_id}", status_code=204)
def remove_favorite(listing_id: int, user=Auth, db: DBSession = Db):
    db.execute(
        delete(Favorite).where(
            Favorite.user_id == user.id, Favorite.listing_id == listing_id
        )
    )
    db.commit()


def conversation_or_404(db, conversation_id, user):
    c = db.get(Conversation, conversation_id)
    if not c or user.id not in (c.owner_id, c.interested_id):
        fail(404, "Conversa não encontrada.")
    return c


def conversation_data(db, c, user):
    last = db.scalar(
        select(Message)
        .where(Message.conversation_id == c.id)
        .order_by(Message.id.desc())
        .limit(1)
    )
    return {
        "id": c.id,
        "listing_id": c.listing_id,
        "listing_title": c.listing.title,
        "listing_image": c.listing.image_url,
        "listing_deleted": c.listing.deleted_at is not None,
        "participant": public_user(c.interested if user.id == c.owner_id else c.owner),
        "last_message": last.content
        if last
        else "Comece a conversa e combine a retirada.",
        "updated_at": public_value(last.created_at if last else c.created_at),
    }


@app.get("/api/conversations")
def conversations(user=Auth, db: DBSession = Db):
    rows = db.scalars(
        select(Conversation).where(
            or_(Conversation.owner_id == user.id, Conversation.interested_id == user.id)
        )
    )
    return sorted(
        [conversation_data(db, c, user) for c in rows],
        key=lambda x: x["updated_at"],
        reverse=True,
    )


@app.post("/api/conversations", status_code=201)
def start_conversation(body: ConversationInput, user=Auth, db: DBSession = Db):
    listing = listing_or_404(db, body.listing_id)
    if listing.owner_id == user.id:
        fail(400, "Você não pode iniciar uma conversa no seu próprio anúncio.")
    c = db.scalar(
        select(Conversation).where(
            Conversation.listing_id == listing.id, Conversation.interested_id == user.id
        )
    )
    if not c:
        if listing.status not in ("available", "reserved"):
            fail(409, "Esta oferta já foi encerrada.")
        c = Conversation(
            listing_id=listing.id, owner_id=listing.owner_id, interested_id=user.id
        )
        db.add(c)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            c = db.scalar(
                select(Conversation).where(
                    Conversation.listing_id == listing.id,
                    Conversation.interested_id == user.id,
                )
            )
    return conversation_data(db, c, user)


@app.get("/api/conversations/{conversation_id}/messages")
def messages(
    conversation_id: int,
    after: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    user=Auth,
    db: DBSession = Db,
):
    c = conversation_or_404(db, conversation_id, user)
    rows = db.scalars(
        select(Message)
        .where(Message.conversation_id == c.id, Message.id > after)
        .order_by(Message.id)
        .limit(limit)
    )
    return {
        "conversation": conversation_data(db, c, user),
        "items": [message_data(m) for m in rows],
    }


def message_data(message):
    return {
        k: public_value(getattr(message, k))
        for k in ("id", "sender_id", "content", "created_at")
    }


@app.post("/api/conversations/{conversation_id}/messages", status_code=201)
def send_message(
    conversation_id: int, body: MessageInput, user=Auth, db: DBSession = Db
):
    conversation_or_404(db, conversation_id, user)
    m = Message(
        conversation_id=conversation_id, sender_id=user.id, content=body.content
    )
    db.add(m)
    db.commit()
    return message_data(m)


@app.get("/api/stats")
def stats(db: DBSession = Db):
    def count(model, *conditions):
        return db.scalar(select(func.count()).select_from(model).where(*conditions))

    return {
        "available": count(
            Listing, Listing.status == "available", Listing.deleted_at.is_(None)
        ),
        "members": count(User),
        "completed": count(
            Listing, Listing.status == "completed", Listing.deleted_at.is_(None)
        ),
        "donations": count(
            Listing, Listing.offer_type == "donation", Listing.deleted_at.is_(None)
        ),
        "demo": bool(count(User, User.email.endswith("@verdeperto.example"))),
    }


@app.get("/api/community-points")
def community_points(db: DBSession = Db):
    return [
        {
            k: getattr(p, k)
            for k in (
                "id",
                "name",
                "description",
                "category",
                "public_latitude",
                "public_longitude",
            )
        }
        for p in db.scalars(select(CommunityPoint))
    ]


@app.post("/api/uploads", status_code=201)
async def upload_image(file: UploadFile = File(...), user=Auth):
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        fail(415, "Use uma imagem JPG, PNG ou WebP.")
    raw = await file.read(5 * 1024 * 1024 + 1)
    if len(raw) > 5 * 1024 * 1024:
        fail(413, "A imagem deve ter até 5 MB.")
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
        image = ImageOps.exif_transpose(image).convert("RGB")
        image.thumbnail((1600, 1600))
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        fail(415, "O arquivo não é uma imagem válida.")
    filename = uuid4().hex + ".jpg"
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    # Reencode remove EXIF/GPS e conteúdo ativo de arquivos enviados.
    if settings.supabase_url and settings.supabase_service_role_key:
        encoded = io.BytesIO()
        image.save(encoded, "JPEG", quality=85)
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                result = await client.post(
                    settings.supabase_url.rstrip("/")
                    + "/storage/v1/object/"
                    + settings.storage_bucket
                    + "/"
                    + filename,
                    content=encoded.getvalue(),
                    headers={
                        "Authorization": "Bearer " + settings.supabase_service_role_key,
                        "apikey": settings.supabase_service_role_key,
                        "Content-Type": "image/jpeg",
                        "x-upsert": "false",
                    },
                )
                result.raise_for_status()
        except httpx.HTTPError:
            fail(
                502, "Não foi possível guardar a imagem. Tente novamente em instantes."
            )
    elif settings.environment == "production":
        fail(503, "Armazenamento persistente de imagens não configurado.")
    else:
        image.save(Path(settings.upload_dir) / filename, "JPEG", quality=85)
    return {"url": "/api/media/" + filename}


@app.get("/api/media/{filename}")
def media(filename: str):
    if not re.fullmatch(r"[a-f0-9]{32}\.jpg", filename):
        fail(404, "Imagem não encontrada.")
    if settings.supabase_url and settings.supabase_service_role_key:
        return RedirectResponse(
            settings.supabase_url.rstrip("/")
            + "/storage/v1/object/public/"
            + settings.storage_bucket
            + "/"
            + filename
        )
    path = Path(settings.upload_dir) / filename
    if not path.is_file():
        fail(404, "Imagem não encontrada.")
    return FileResponse(path, media_type="image/jpeg")
