from datetime import datetime

from sqlalchemy import String, Float, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, validates, relationship

from database import Base


def normalizar(texto: str) -> str:
    # strip + minúsculas + espacios dobles colapsados
    return " ".join(texto.lower().split())


class Insumo(Base):
    __tablename__ = "insumos"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String, unique=True)
    unidad: Mapped[str] = mapped_column(String)  # "g" o "ml"
    stock_actual: Mapped[float] = mapped_column(Float, default=0)
    stock_ideal: Mapped[float] = mapped_column(Float, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    @validates("nombre")
    def _normalizar_nombre(self, key, valor):
        return normalizar(valor)


class ProductoTerminado(Base):
    __tablename__ = "productos_terminados"
    __table_args__ = (UniqueConstraint("nombre", "gramaje"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String)
    gramaje: Mapped[float] = mapped_column(Float)  # en gramos
    stock_actual: Mapped[int] = mapped_column(Integer, default=0)  # unidades
    stock_ideal: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    @validates("nombre")
    def _normalizar_nombre(self, key, valor):
        return normalizar(valor)

class Receta(Base):
    __tablename__ = "recetas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String, unique=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos_terminados.id"))
    output_esperado: Mapped[int] = mapped_column(Integer)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    producto: Mapped["ProductoTerminado"] = relationship()
    ingredientes: Mapped[list["RecetaIngrediente"]] = relationship(
        back_populates="receta", cascade="all, delete-orphan"
    )

    @validates("nombre")
    def _normalizar_nombre(self, key, valor):
        return normalizar(valor)


class RecetaIngrediente(Base):
    __tablename__ = "receta_ingredientes"
    __table_args__ = (UniqueConstraint("receta_id", "insumo_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    receta_id: Mapped[int] = mapped_column(ForeignKey("recetas.id"))
    insumo_id: Mapped[int] = mapped_column(ForeignKey("insumos.id"))
    cantidad: Mapped[float] = mapped_column(Float)  # g o ml, según el insumo

    receta: Mapped["Receta"] = relationship(back_populates="ingredientes")
    insumo: Mapped["Insumo"] = relationship()


class Produccion(Base):
    __tablename__ = "producciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    receta_id: Mapped[int] = mapped_column(ForeignKey("recetas.id"))
    lotes: Mapped[float] = mapped_column(Float, default=1)
    estado: Mapped[str] = mapped_column(String, default="en_preparacion")
    fecha_inicio: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    fecha_fin: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cantidad_obtenida: Mapped[int | None] = mapped_column(Integer, nullable=True)

    receta: Mapped["Receta"] = relationship()


class Movimiento(Base):
    __tablename__ = "movimientos"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    tipo: Mapped[str] = mapped_column(String)
    cantidad: Mapped[float] = mapped_column(Float)  # + entra, - sale
    nota: Mapped[str | None] = mapped_column(String, nullable=True)

    insumo_id: Mapped[int | None] = mapped_column(ForeignKey("insumos.id"), nullable=True)
    producto_id: Mapped[int | None] = mapped_column(
        ForeignKey("productos_terminados.id"), nullable=True
    )
    produccion_id: Mapped[int | None] = mapped_column(
        ForeignKey("producciones.id"), nullable=True
    )