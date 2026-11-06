from datetime import datetime, timezone
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./verdeperto.db"
    environment: str = "development"
    cors_origins: list[str] = ["http://localhost:4200", "http://127.0.0.1:4200"]
    upload_dir: str = "./uploads"
    session_days: int = 7
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    storage_bucket: str = "offers"
    frontend_dist: str = ""


settings = Settings()
database_url = settings.database_url.replace("postgres://", "postgresql+psycopg://", 1)
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+psycopg://", 1)
engine = create_engine(
    database_url,
    connect_args={"check_same_thread": False}
    if database_url.startswith("sqlite")
    else {},
    pool_pre_ping=True,
)
if database_url.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def sqlite_foreign_keys(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def now():
    return datetime.now(timezone.utc)


def get_db():
    with SessionLocal() as db:
        yield db


def init_db():
    from . import models  # noqa: F401

    Base.metadata.create_all(engine)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
