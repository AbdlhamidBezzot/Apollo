"""Database engine, session factory and FastAPI dependency.

Works with PostgreSQL. Connection pooling is handled by the engine; index your hot
query columns (see models.py __table_args__).
"""

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401  (register models)

    Base.metadata.create_all(bind=engine)
    _apply_migrations()


def _apply_migrations() -> None:
    """Idempotent ALTER TABLE migrations for columns added after initial deploy."""
    with engine.begin() as conn:
        # Idempotent column additions
        for table, definitions in {
            "watch_history": {"season_number": "INTEGER", "episode_number": "INTEGER"},
            "user_addon_preferences": {"custom_manifest_url": "VARCHAR(1000)"},
        }.items():
            for column, ddl in definitions.items():
                existing = {col["name"] for col in sa_inspect(conn).get_columns(table)}
                if column not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))



