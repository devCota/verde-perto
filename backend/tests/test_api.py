import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from PIL import Image
from app.core import Base, get_db
from app.main import app
from app.models import Listing, User


@pytest.fixture
def clients(tmp_path):
    engine = create_engine(
        "sqlite:///" + str(tmp_path / "test.db"),
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)

    def db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = db
    alice, bob, outsider = TestClient(app), TestClient(app), TestClient(app)
    for client, name in ((alice, "Alice"), (bob, "Bob"), (outsider, "Carla")):
        r = client.post(
            "/api/auth/register",
            json={
                "name": name,
                "email": name.lower() + "@example.com",
                "password": "Password123!",
                "city": "Contagem",
                "neighborhood": "Eldorado",
            },
        )
        assert r.status_code == 201, r.text
    yield alice, bob, outsider, factory
    app.dependency_overrides.clear()
    engine.dispose()


def offer(**changes):
    return {
        "title": "Limões do quintal",
        "description": "Colheita local para compartilhar com a vizinhança.",
        "category": "fruits",
        "quantity": 20,
        "unit": "unidades",
        "offer_type": "donation",
        "city": "Contagem",
        "neighborhood": "Eldorado",
        "public_latitude": -19.943817,
        "public_longitude": -44.041278,
        **changes,
    }


def create(client, **changes):
    response = client.post("/api/listings", json=offer(**changes))
    assert response.status_code == 201, response.text
    return response.json()


def test_register_login_session_logout(clients):
    alice, _, _, factory = clients
    assert alice.get("/api/auth/me").json()["name"] == "Alice"
    alice.post("/api/auth/logout")
    assert alice.get("/api/auth/me").status_code == 401
    assert (
        alice.post(
            "/api/auth/login", json={"email": "alice@example.com", "password": "wrong"}
        ).status_code
        == 401
    )
    login = alice.post(
        "/api/auth/login",
        json={"email": "ALICE@example.com", "password": "Password123!"},
    )
    assert login.status_code == 200
    assert "HttpOnly" in login.headers["set-cookie"]
    assert "password_hash" not in login.json()
    with factory() as db:
        assert db.scalar(select(User)).password_hash.startswith("$argon2")


def test_registration_validation_and_duplicate(clients):
    a = clients[0]
    data = {
        "name": "Other",
        "email": "alice@example.com",
        "password": "Password123!",
        "city": "Contagem",
        "neighborhood": "Centro",
    }
    assert a.post("/api/auth/register", json=data).status_code == 409
    assert (
        a.post("/api/auth/register", json={**data, "password": "123"}).status_code
        == 422
    )


def test_privacy_all_public_endpoints_and_database(clients):
    a, b, _, factory = clients
    l = create(a)
    assert l["public_latitude"] == -19.94 and l["public_longitude"] == -44.04
    for endpoint in [
        "/api/listings",
        "/api/map/listings",
        "/api/listings/" + str(l["id"]),
        "/api/users/" + str(l["owner_id"]),
    ]:
        data = b.get(endpoint).text
        for secret in (
            "-19.943817",
            "-44.041278",
            "password_hash",
            "alice@example.com",
            "token_hash",
        ):
            assert secret not in data
    with factory() as db:
        row = db.get(Listing, l["id"])
        assert row.public_latitude == -19.94 and row.public_longitude == -44.04


def test_owner_permissions_edit_delete(clients):
    a, b, _, _ = clients
    l = create(a)
    assert b.patch(f"/api/listings/{l['id']}", json=offer()).status_code == 403
    assert b.delete(f"/api/listings/{l['id']}").status_code == 403
    assert (
        a.patch(f"/api/listings/{l['id']}", json=offer(title="Limões novos")).json()[
            "title"
        ]
        == "Limões novos"
    )
    assert a.delete(f"/api/listings/{l['id']}").status_code == 204
    assert b.get(f"/api/listings/{l['id']}").status_code == 404


def test_availability_and_nonnegative_quantity(clients):
    a, b, _, _ = clients
    l = create(a)
    path = f"/api/listings/{l['id']}/availability"
    assert (
        a.patch(path, json={"quantity": -1, "status": "available"}).status_code == 422
    )
    assert (
        b.patch(path, json={"quantity": 12, "status": "available"}).status_code == 403
    )
    assert (
        a.patch(path, json={"quantity": 12, "status": "reserved"}).json()["quantity"]
        == 12
    )
    assert (
        a.patch(path, json={"quantity": 0, "status": "available"}).json()["status"]
        == "completed"
    )


def test_favorites_idempotent_and_private(clients):
    a, b, c, _ = clients
    l = create(a)
    for _ in range(2):
        assert b.post(f"/api/favorites/{l['id']}").status_code == 201
    assert len(b.get("/api/favorites").json()) == 1
    assert c.get("/api/favorites").json() == []
    assert b.delete(f"/api/favorites/{l['id']}").status_code == 204
    assert b.get("/api/favorites").json() == []


def test_chat_permissions_duplicates_and_history(clients):
    a, b, c, _ = clients
    l = create(a)
    body = {"listing_id": l["id"]}
    assert a.post("/api/conversations", json=body).status_code == 400
    conversation = b.post("/api/conversations", json=body).json()
    assert b.post("/api/conversations", json=body).json()["id"] == conversation["id"]
    path = f"/api/conversations/{conversation['id']}/messages"
    assert c.get(path).status_code == 404
    assert c.post(path, json={"content": "invasão"}).status_code == 404
    assert (
        b.post(path, json={"content": "Podemos combinar às 15h na praça?"}).status_code
        == 201
    )
    assert (
        a.get(path).json()["items"][0]["content"] == "Podemos combinar às 15h na praça?"
    )
    assert a.post(path, json={"content": "Combinado!"}).status_code == 201
    assert len(b.get(path).json()["items"]) == 2
    assert (
        b.get(path, params={"after": b.get(path).json()["items"][-1]["id"]}).json()[
            "items"
        ]
        == []
    )
    a.delete(f"/api/listings/{l['id']}")
    assert a.get(path).json()["conversation"]["listing_deleted"] is True
    assert len(a.get(path).json()["items"]) == 2


def test_filters_pagination_map_and_proximity(clients):
    a = clients[0]
    create(a)
    create(
        a,
        title="Mudas para trocar",
        category="plants",
        offer_type="exchange",
        public_latitude=-19.96,
    )
    create(a, title="Tomates", category="vegetables", offer_type="sale", price=8.50)
    for params, title in [
        ({"q": "Limões"}, "Limões do quintal"),
        ({"category": "plants"}, "Mudas para trocar"),
        ({"offer_type": "sale"}, "Tomates"),
    ]:
        result = a.get("/api/listings", params=params).json()
        assert result["total"] == 1 and result["items"][0]["title"] == title
    assert len(a.get("/api/listings", params={"page_size": 1}).json()["items"]) == 1
    assert a.get("/api/listings", params={"page_size": 10000}).status_code == 422
    near = a.get("/api/map/listings", params={"lat": -19.96, "lng": -44.04}).json()[
        "items"
    ][0]
    assert near["title"] == "Mudas para trocar"


def test_price_and_fields_validation(clients):
    a = clients[0]
    for changes in [
        {"quantity": -5},
        {"offer_type": "sale"},
        {"offer_type": "sale", "price": -1},
        {"public_latitude": 500},
        {"private_latitude": -19.123456},
        {"image_url": "https://unknown.example/x.svg"},
        {"title": "x"},
    ]:
        assert a.post("/api/listings", json=offer(**changes)).status_code == 422


def test_password_change_invalidates_other_sessions(clients):
    a = clients[0]
    other = TestClient(app)
    other.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "Password123!"},
    )
    assert (
        a.post(
            "/api/users/me/password",
            json={"current_password": "wrong", "new_password": "NewPassword123!"},
        ).status_code
        == 400
    )
    assert (
        a.post(
            "/api/users/me/password",
            json={
                "current_password": "Password123!",
                "new_password": "NewPassword123!",
            },
        ).status_code
        == 200
    )
    assert other.get("/api/auth/me").status_code == 401
    assert a.get("/api/auth/me").status_code == 200


def test_upload_validation_and_image_privacy(clients, tmp_path, monkeypatch):
    from app.main import settings

    monkeypatch.setattr(settings, "upload_dir", str(tmp_path))
    a = clients[0]
    assert (
        a.post(
            "/api/uploads", files={"file": ("bad.jpg", b"not an image", "image/jpeg")}
        ).status_code
        == 415
    )
    assert (
        a.post(
            "/api/uploads", files={"file": ("x.svg", b"<svg/>", "image/svg+xml")}
        ).status_code
        == 415
    )
    image = Image.new("RGB", (20, 20), "green")
    raw = io.BytesIO()
    image.save(raw, "JPEG")
    r = a.post(
        "/api/uploads", files={"file": ("test.jpg", raw.getvalue(), "image/jpeg")}
    )
    assert r.status_code == 201
    result = Image.open(tmp_path / r.json()["url"].split("/")[-1])
    assert not result.getexif()


def test_cross_origin_write_rejected(clients):
    a = clients[0]
    assert (
        a.post(
            "/api/listings", json=offer(), headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )


def test_donation_journey(clients):
    a, b, _, _ = clients
    listing = create(a)
    found = b.get("/api/listings", params={"q": "limões"}).json()["items"][0]
    assert found["id"] == listing["id"]
    conversation = b.post("/api/conversations", json={"listing_id": found["id"]}).json()
    path = f"/api/conversations/{conversation['id']}/messages"
    b.post(path, json={"content": "Posso buscar 8 limões na praça?"})
    a.post(path, json={"content": "Pode sim! Às 15h."})
    a.patch(
        f"/api/listings/{listing['id']}/availability",
        json={"quantity": 12, "status": "available"},
    )
    result = a.patch(
        f"/api/listings/{listing['id']}/availability",
        json={"quantity": 0, "status": "completed"},
    )
    assert result.json()["status"] == "completed"
    assert b.get("/api/listings").json()["items"] == []
