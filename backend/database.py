from contextlib import contextmanager
from sqlmodel import SQLModel, create_engine, Session

# SQLite database file - production would use PostgreSQL
DATABASE_URL = "sqlite:///./mandipulse.db"
engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})

def create_db_and_tables():
    """Create all database tables from SQLModel metadata."""
    # Import models so SQLModel registers them before creating tables
    from . import models  # noqa: F401
    SQLModel.metadata.create_all(engine)

@contextmanager
def get_session_ctx():
    """Context manager for DB session."""
    session = Session(engine)
    try:
        yield session
    finally:
        session.close()

def get_session():
    """FastAPI dependency: yields a DB session."""
    with Session(engine) as session:
        yield session
