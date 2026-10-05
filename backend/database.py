from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from pathlib import Path

RUTA_BD = Path(__file__).parent / "inventario.db"
URL_BD = f"sqlite:///{RUTA_BD.as_posix()}"

engine = create_engine(URL_BD, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()