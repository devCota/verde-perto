"""Dados fictícios para apresentação. Execução explícita: python -m app.seed."""

import os
from sqlalchemy import select
from .core import init_db, SessionLocal, settings
from .main import passwords
from .models import User, Listing, Favorite, Conversation, Message

DEMO_PASSWORD = "DemoVerde123!"


def seed():
    if settings.environment == "production" and os.getenv("ALLOW_DEMO_SEED") != "true":
        raise SystemExit(
            "Seed bloqueado em produção. Exige ALLOW_DEMO_SEED=true explicitamente."
        )
    init_db()
    with SessionLocal() as db:
        users = []
        for name, email, neighborhood in [
            ("Ana Oliveira", "ana@verdeperto.example", "Eldorado"),
            ("João Santos", "joao@verdeperto.example", "Riacho das Pedras"),
            ("Maria Costa", "maria@verdeperto.example", "Centro"),
        ]:
            user = db.scalar(select(User).where(User.email == email))
            if not user:
                user = User(
                    name=name,
                    email=email,
                    password_hash=passwords.hash(DEMO_PASSWORD),
                    city="Contagem",
                    neighborhood=neighborhood,
                    bio="Perfil fictício de demonstração. Cultivar e compartilhar faz parte do meu dia.",
                )
                db.add(user)
                db.flush()
            users.append(user)
        examples = [
            (
                "Limões fresquinhos do quintal",
                "fruits",
                20,
                "unidades",
                "donation",
                None,
                "lemons.jpg",
                "Eldorado",
                -19.94,
                -44.04,
                "available",
                "",
            ),
            (
                "Mudas de manjericão",
                "plants",
                6,
                "mudas",
                "exchange",
                None,
                "herbs.jpg",
                "Riacho das Pedras",
                -19.96,
                -44.05,
                "available",
                "Sementes ou outras ervas para minha horta",
            ),
            (
                "Tomates colhidos hoje",
                "vegetables",
                3,
                "kg",
                "sale",
                8.50,
                "tomatoes.jpg",
                "Centro",
                -19.93,
                -44.08,
                "available",
                "",
            ),
            (
                "Uma cesta de folhas verdes",
                "greens",
                4,
                "maços",
                "donation",
                None,
                "greens.jpg",
                "Industrial",
                -19.96,
                -44.03,
                "available",
                "",
            ),
            (
                "Alecrim para sua horta",
                "herbs",
                8,
                "mudas",
                "exchange",
                None,
                "herbs.jpg",
                "Eldorado",
                -19.94,
                -44.04,
                "available",
                "Mudas de hortelã ou cebolinha",
            ),
            (
                "Laranjas do nosso pomar",
                "fruits",
                5,
                "kg",
                "donation",
                None,
                "oranges.jpg",
                "Centro",
                -19.93,
                -44.08,
                "available",
                "",
            ),
            (
                "Sementes de girassol",
                "seeds",
                3,
                "pacotes",
                "exchange",
                None,
                "garden.jpg",
                "Eldorado",
                -19.94,
                -44.04,
                "reserved",
                "Sementes de flores",
            ),
            (
                "Hortaliças compartilhadas",
                "greens",
                0,
                "maços",
                "donation",
                None,
                "greens.jpg",
                "Riacho das Pedras",
                -19.96,
                -44.05,
                "completed",
                "",
            ),
            (
                "Muda de limoeiro",
                "plants",
                1,
                "mudas",
                "sale",
                25,
                "garden.jpg",
                "Centro",
                -19.93,
                -44.08,
                "unavailable",
                "",
            ),
        ]
        seeded = []
        for i, (
            title,
            category,
            quantity,
            unit,
            offer,
            price,
            image,
            neighborhood,
            lat,
            lng,
            status,
            exchange,
        ) in enumerate(examples):
            owner = users[i % len(users)]
            listing = db.scalar(
                select(Listing).where(
                    Listing.title == title, Listing.owner_id == owner.id
                )
            )
            if not listing:
                listing = Listing(
                    owner_id=owner.id,
                    title=title,
                    description="Oferta fictícia para demonstração acadêmica do VerdePerto. Produto de cultivo local; combine os detalhes e a retirada pelo chat. A localização representa apenas a região aproximada.",
                    category=category,
                    quantity=quantity,
                    unit=unit,
                    offer_type=offer,
                    price=price,
                    image_url="/assets/" + image,
                    city="Contagem",
                    neighborhood=neighborhood,
                    public_latitude=lat,
                    public_longitude=lng,
                    status=status,
                    exchange_for=exchange,
                )
                db.add(listing)
                db.flush()
            seeded.append(listing)
        if not db.scalar(
            select(Favorite).where(
                Favorite.user_id == users[1].id, Favorite.listing_id == seeded[1].id
            )
        ):
            db.add(Favorite(user_id=users[1].id, listing_id=seeded[1].id))
        c = db.scalar(
            select(Conversation).where(
                Conversation.listing_id == seeded[0].id,
                Conversation.interested_id == users[1].id,
            )
        )
        if not c:
            c = Conversation(
                listing_id=seeded[0].id, owner_id=users[0].id, interested_id=users[1].id
            )
            db.add(c)
            db.flush()
            db.add_all(
                [
                    Message(
                        conversation_id=c.id,
                        sender_id=users[1].id,
                        content="Olá, Ana! Ainda tem limões disponíveis? Gostaria de buscar alguns.",
                    ),
                    Message(
                        conversation_id=c.id,
                        sender_id=users[0].id,
                        content="Olá! Tem sim. Podemos combinar a retirada em um ponto público do bairro.",
                    ),
                ]
            )
        db.commit()
    print("Demonstração pronta (seed idempotente).")
    print("ana@verdeperto.example ou joao@verdeperto.example | senha: " + DEMO_PASSWORD)


if __name__ == "__main__":
    seed()
