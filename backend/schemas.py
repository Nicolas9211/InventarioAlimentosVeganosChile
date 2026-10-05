from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from datetime import datetime


class InsumoCrear(BaseModel):
    nombre: str = Field(min_length=1)
    unidad: str
    stock_inicial: float = Field(default=0, ge=0)
    stock_ideal: float = Field(default=0, ge=0)

    @field_validator("unidad")
    @classmethod
    def validar_unidad(cls, valor: str) -> str:
        valor = valor.strip().lower()
        if valor not in ("g", "ml"):
            raise ValueError("La unidad debe ser 'g' o 'ml'")
        return valor


class InsumoSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    unidad: str
    stock_actual: float
    stock_ideal: float
    activo: bool

class ProductoCrear(BaseModel):
    nombre: str = Field(min_length=1)
    gramaje: float = Field(gt=0)
    stock_inicial: int = Field(default=0, ge=0)
    stock_ideal: int = Field(default=0, ge=0)


class ProductoSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    gramaje: float
    stock_actual: int
    stock_ideal: int
    activo: bool
class IngredienteCrear(BaseModel):
    insumo_id: int
    cantidad: float = Field(gt=0)


class ProductoNuevo(BaseModel):
    nombre: str = Field(min_length=1)
    gramaje: float = Field(gt=0)
    stock_ideal: int = Field(default=0, ge=0)


class RecetaCrear(BaseModel):
    nombre: str = Field(min_length=1)
    producto_id: int | None = None
    producto_nuevo: ProductoNuevo | None = None
    output_esperado: int = Field(gt=0)
    ingredientes: list[IngredienteCrear] = Field(min_length=1)

    @model_validator(mode="after")
    def validar_producto(self):
        if (self.producto_id is None) == (self.producto_nuevo is None):
            raise ValueError(
                "Indica un producto existente o un producto nuevo (solo uno de los dos)"
            )
        return self


class IngredienteSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    cantidad: float
    insumo: InsumoSalida


class RecetaSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    output_esperado: int
    producto: ProductoSalida
    ingredientes: list[IngredienteSalida]
    activo: bool

class ProduccionIniciar(BaseModel):
    receta_id: int
    lotes: float = Field(default=1, gt=0)


class ProduccionTerminar(BaseModel):
    cantidad_obtenida: int = Field(ge=0)


class ProduccionSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    estado: str
    lotes: float
    fecha_inicio: datetime
    fecha_fin: datetime | None
    cantidad_obtenida: int | None
    receta: RecetaSalida

class CompraCrear(BaseModel):
    insumo_id: int
    cantidad: float = Field(gt=0)


class VentaCrear(BaseModel):
    producto_id: int
    cantidad: int = Field(gt=0)


class AjusteInsumo(BaseModel):
    insumo_id: int
    stock_real: float = Field(ge=0)
    nota: str | None = None


class AjusteProducto(BaseModel):
    producto_id: int
    stock_real: int = Field(ge=0)
    nota: str | None = None


class MovimientoSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: datetime
    tipo: str
    cantidad: float
    nota: str | None
    insumo_id: int | None
    producto_id: int | None
    produccion_id: int | None

class InsumoEditar(BaseModel):
    nombre: str = Field(min_length=1)
    stock_ideal: float = Field(ge=0)


class ProductoEditar(BaseModel):
    nombre: str = Field(min_length=1)
    gramaje: float = Field(gt=0)
    stock_ideal: int = Field(ge=0)


class CambioActivo(BaseModel):
    activo: bool