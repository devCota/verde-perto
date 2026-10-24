from datetime import datetime
from sqlalchemy import (
    String,
    Text,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .core import Base, now


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(300), default=None)
    bio: Mapped[str] = mapped_column(String(500), default="")
    city: Mapped[str] = mapped_column(String(80))
    neighborhood: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(default=now)


class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime]


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="quantity_nonnegative"),
        CheckConstraint("price IS NULL OR price >= 0", name="price_nonnegative"),
        Index("ix_listing_region_status", "city", "status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40), index=True)
    quantity: Mapped[float]
    unit: Mapped[str] = mapped_column(String(20))
    offer_type: Mapped[str] = mapped_column(String(12), index=True)
    price: Mapped[float | None]
    exchange_for: Mapped[str] = mapped_column(String(200), default="")
    image_url: Mapped[str | None] = mapped_column(String(300))
    city: Mapped[str] = mapped_column(String(80))
    neighborhood: Mapped[str] = mapped_column(String(80))
    public_latitude: Mapped[float]
    public_longitude: Mapped[float]
    status: Mapped[str] = mapped_column(String(20), default="available", index=True)
    created_at: Mapped[datetime] = mapped_column(default=now, index=True)
    updated_at: Mapped[datetime] = mapped_column(default=now, onupdate=now)
    deleted_at: Mapped[datetime | None] = mapped_column(default=None)
    owner: Mapped[User] = relationship()


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "listing_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("listing_id", "interested_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    interested_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=now)
    listing: Mapped[Listing] = relationship()
    owner: Mapped[User] = relationship(foreign_keys=[owner_id])
    interested: Mapped[User] = relationship(foreign_keys=[interested_id])


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id"), index=True
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    content: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(default=now)


class CommunityPoint(Base):
    __tablename__ = "community_points"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(40))
    public_latitude: Mapped[float]
    public_longitude: Mapped[float]
