from datetime import datetime

from sqlalchemy.orm import Session

import models

from sqlalchemy import select


class ErrorDeNegocio(Exception):
    """Error pensado para mostrarse al usuario (ej: falta stock)."""


def iniciar_produccion(db: Session, receta_id: int, lotes: float = 1) -> models.Produccion:
    receta = db.get(models.Receta, receta_id)
    if receta is None:
        raise ErrorDeNegocio("La receta no existe")
    if lotes <= 0:
        raise ErrorDeNegocio("Los lotes deben ser mayores que cero")
    if not receta.activo:
        raise ErrorDeNegocio("La receta está desactivada")

    # 1. Verificar que alcanzan todos los insumos ANTES de descontar algo
    faltantes = []
    for ing in receta.ingredientes:
        necesario = ing.cantidad * lotes
        if ing.insumo.stock_actual < necesario:
            faltantes.append(
                f"{ing.insumo.nombre}: necesitas {necesario} {ing.insumo.unidad}, "
                f"hay {ing.insumo.stock_actual}"
            )
    if faltantes:
        raise ErrorDeNegocio("Stock insuficiente -> " + "; ".join(faltantes))

    # 2. Crear la producción
    produccion = models.Produccion(receta_id=receta.id, lotes=lotes)
    db.add(produccion)
    db.flush()  # asigna el id sin confirmar todavía

    # 3. Descontar insumos y registrar cada movimiento
    for ing in receta.ingredientes:
        necesario = ing.cantidad * lotes
        ing.insumo.stock_actual -= necesario
        db.add(
            models.Movimiento(
                tipo="consumo_produccion",
                cantidad=-necesario,
                insumo_id=ing.insumo_id,
                produccion_id=produccion.id,
            )
        )

    db.commit()
    db.refresh(produccion)
    return produccion


def terminar_produccion(db: Session, produccion_id: int, cantidad_obtenida: int) -> models.Produccion:
    produccion = db.get(models.Produccion, produccion_id)
    if produccion is None:
        raise ErrorDeNegocio("La producción no existe")
    if produccion.estado != "en_preparacion":
        raise ErrorDeNegocio("Esta producción ya fue terminada")
    if cantidad_obtenida < 0:
        raise ErrorDeNegocio("La cantidad obtenida no puede ser negativa")

    producto = produccion.receta.producto
    producto.stock_actual += cantidad_obtenida

    produccion.estado = "terminada"
    produccion.fecha_fin = datetime.now()
    produccion.cantidad_obtenida = cantidad_obtenida

    db.add(
        models.Movimiento(
            tipo="ingreso_produccion",
            cantidad=cantidad_obtenida,
            producto_id=producto.id,
            produccion_id=produccion.id,
        )
    )

    db.commit()
    db.refresh(produccion)
    return produccion


def crear_insumo(
    db: Session, nombre: str, unidad: str, stock_inicial: float, stock_ideal: float
) -> models.Insumo:
    existente = db.scalar(
        select(models.Insumo).where(models.Insumo.nombre == models.normalizar(nombre))
    )
    if existente is not None:
        if not existente.activo:
            raise ErrorDeNegocio(
                f"Ya existe un insumo llamado '{existente.nombre}', pero está "
                "desactivado. Reactívalo en vez de crearlo de nuevo"
            )
        raise ErrorDeNegocio(f"Ya existe un insumo llamado '{existente.nombre}'")

    insumo = models.Insumo(
        nombre=nombre,
        unidad=unidad,
        stock_actual=stock_inicial,
        stock_ideal=stock_ideal,
    )
    db.add(insumo)
    db.flush()

    if stock_inicial > 0:
        db.add(
            models.Movimiento(
                tipo="stock_inicial",
                cantidad=stock_inicial,
                insumo_id=insumo.id,
            )
        )

    db.commit()
    db.refresh(insumo)
    return insumo

def crear_producto(
    db: Session, nombre: str, gramaje: float, stock_inicial: int, stock_ideal: int
) -> models.ProductoTerminado:
    existente = db.scalar(
        select(models.ProductoTerminado).where(
            models.ProductoTerminado.nombre == models.normalizar(nombre),
            models.ProductoTerminado.gramaje == gramaje,
        )
    )
    if existente is not None:
        if not existente.activo:
            raise ErrorDeNegocio(
                f"Ya existe '{existente.nombre}' de {existente.gramaje} g, pero está "
                "desactivado. Reactívalo en vez de crearlo de nuevo"
            )
        raise ErrorDeNegocio(f"Ya existe '{existente.nombre}' de {existente.gramaje} g")

    producto = models.ProductoTerminado(
        nombre=nombre,
        gramaje=gramaje,
        stock_actual=stock_inicial,
        stock_ideal=stock_ideal,
    )
    db.add(producto)
    db.flush()

    if stock_inicial > 0:
        db.add(
            models.Movimiento(
                tipo="stock_inicial",
                cantidad=stock_inicial,
                producto_id=producto.id,
            )
        )

    db.commit()
    db.refresh(producto)
    return producto


def _validar_ingredientes(db: Session, ingredientes: list) -> None:
    ids = [ing.insumo_id for ing in ingredientes]
    if len(ids) != len(set(ids)):
        raise ErrorDeNegocio("Hay insumos repetidos en la receta")
    for insumo_id in ids:
        insumo = db.get(models.Insumo, insumo_id)
        if insumo is None:
            raise ErrorDeNegocio(f"El insumo con id {insumo_id} no existe")
        if not insumo.activo:
            raise ErrorDeNegocio(f"El insumo '{insumo.nombre}' está desactivado")


def _resolver_producto(
    db: Session, producto_id: int | None, producto_nuevo
) -> models.ProductoTerminado:
    if producto_nuevo is not None:
        existente = db.scalar(
            select(models.ProductoTerminado).where(
                models.ProductoTerminado.nombre == models.normalizar(producto_nuevo.nombre),
                models.ProductoTerminado.gramaje == producto_nuevo.gramaje,
            )
        )
        if existente is not None:
            raise ErrorDeNegocio(
                f"Ya existe '{existente.nombre}' de {existente.gramaje} g: "
                "elígelo de la lista en vez de crearlo de nuevo"
            )
        producto = models.ProductoTerminado(
            nombre=producto_nuevo.nombre,
            gramaje=producto_nuevo.gramaje,
            stock_actual=0,
            stock_ideal=producto_nuevo.stock_ideal,
        )
        db.add(producto)
        db.flush()
        return producto

    producto = db.get(models.ProductoTerminado, producto_id)
    if producto is None:
        raise ErrorDeNegocio("El producto terminado no existe")
    if not producto.activo:
        raise ErrorDeNegocio(
            f"El producto '{producto.nombre}' {producto.gramaje} g está desactivado"
        )
    return producto


def _validar_sin_produccion_en_curso(db: Session, receta_id: int) -> None:
    en_curso = db.scalar(
        select(models.Produccion).where(
            models.Produccion.receta_id == receta_id,
            models.Produccion.estado == "en_preparacion",
        )
    )
    if en_curso is not None:
        raise ErrorDeNegocio(
            "Esta receta tiene una producción en preparación. Termínala primero"
        )


def crear_receta(
    db: Session,
    nombre: str,
    producto_id: int | None,
    producto_nuevo,
    output_esperado: int,
    ingredientes: list,
) -> models.Receta:
    existente = db.scalar(
        select(models.Receta).where(models.Receta.nombre == models.normalizar(nombre))
    )
    if existente is not None:
        if not existente.activo:
            raise ErrorDeNegocio(
                f"Ya existe una receta llamada '{existente.nombre}', pero está "
                "desactivada. Reactívala en vez de crearla de nuevo"
            )
        raise ErrorDeNegocio(f"Ya existe una receta llamada '{existente.nombre}'")

    _validar_ingredientes(db, ingredientes)
    producto = _resolver_producto(db, producto_id, producto_nuevo)

    receta = models.Receta(
        nombre=nombre, producto_id=producto.id, output_esperado=output_esperado
    )
    receta.ingredientes = [
        models.RecetaIngrediente(insumo_id=ing.insumo_id, cantidad=ing.cantidad)
        for ing in ingredientes
    ]
    db.add(receta)
    db.commit()
    db.refresh(receta)
    return receta

def registrar_compra(db: Session, insumo_id: int, cantidad: float) -> models.Insumo:
    insumo = db.get(models.Insumo, insumo_id)
    if insumo is None:
        raise ErrorDeNegocio("El insumo no existe")

    insumo.stock_actual += cantidad
    db.add(models.Movimiento(tipo="compra", cantidad=cantidad, insumo_id=insumo.id))
    db.commit()
    db.refresh(insumo)
    return insumo


def registrar_venta(db: Session, producto_id: int, cantidad: int) -> models.ProductoTerminado:
    producto = db.get(models.ProductoTerminado, producto_id)
    if producto is None:
        raise ErrorDeNegocio("El producto no existe")
    if cantidad > producto.stock_actual:
        raise ErrorDeNegocio(
            f"Stock insuficiente: hay {producto.stock_actual} unidades "
            f"de '{producto.nombre}' {producto.gramaje} g y quieres vender {cantidad}"
        )

    producto.stock_actual -= cantidad
    db.add(
        models.Movimiento(tipo="venta", cantidad=-cantidad, producto_id=producto.id)
    )
    db.commit()
    db.refresh(producto)
    return producto


def ajustar_insumo(
    db: Session, insumo_id: int, stock_real: float, nota: str | None
) -> models.Insumo:
    insumo = db.get(models.Insumo, insumo_id)
    if insumo is None:
        raise ErrorDeNegocio("El insumo no existe")

    diferencia = stock_real - insumo.stock_actual
    insumo.stock_actual = stock_real
    if diferencia != 0:
        db.add(
            models.Movimiento(
                tipo="ajuste", cantidad=diferencia, nota=nota, insumo_id=insumo.id
            )
        )
    db.commit()
    db.refresh(insumo)
    return insumo


def ajustar_producto(
    db: Session, producto_id: int, stock_real: int, nota: str | None
) -> models.ProductoTerminado:
    producto = db.get(models.ProductoTerminado, producto_id)
    if producto is None:
        raise ErrorDeNegocio("El producto no existe")

    diferencia = stock_real - producto.stock_actual
    producto.stock_actual = stock_real
    if diferencia != 0:
        db.add(
            models.Movimiento(
                tipo="ajuste", cantidad=diferencia, nota=nota, producto_id=producto.id
            )
        )
    db.commit()
    db.refresh(producto)
    return producto

def editar_insumo(
    db: Session, insumo_id: int, nombre: str, stock_ideal: float
) -> models.Insumo:
    insumo = db.get(models.Insumo, insumo_id)
    if insumo is None:
        raise ErrorDeNegocio("El insumo no existe")

    otro = db.scalar(
        select(models.Insumo).where(
            models.Insumo.nombre == models.normalizar(nombre),
            models.Insumo.id != insumo_id,
        )
    )
    if otro is not None:
        raise ErrorDeNegocio(f"Ya existe otro insumo llamado '{otro.nombre}'")

    insumo.nombre = nombre
    insumo.stock_ideal = stock_ideal
    db.commit()
    db.refresh(insumo)
    return insumo


def editar_producto(
    db: Session, producto_id: int, nombre: str, gramaje: float, stock_ideal: int
) -> models.ProductoTerminado:
    producto = db.get(models.ProductoTerminado, producto_id)
    if producto is None:
        raise ErrorDeNegocio("El producto no existe")

    otro = db.scalar(
        select(models.ProductoTerminado).where(
            models.ProductoTerminado.nombre == models.normalizar(nombre),
            models.ProductoTerminado.gramaje == gramaje,
            models.ProductoTerminado.id != producto_id,
        )
    )
    if otro is not None:
        raise ErrorDeNegocio(f"Ya existe '{otro.nombre}' de {otro.gramaje} g")

    producto.nombre = nombre
    producto.gramaje = gramaje
    producto.stock_ideal = stock_ideal
    db.commit()
    db.refresh(producto)
    return producto


def cambiar_activo_insumo(db: Session, insumo_id: int, activo: bool) -> models.Insumo:
    insumo = db.get(models.Insumo, insumo_id)
    if insumo is None:
        raise ErrorDeNegocio("El insumo no existe")

    if not activo:
        if abs(insumo.stock_actual) > 1e-6:
            raise ErrorDeNegocio(
                f"No se puede desactivar: aún quedan {insumo.stock_actual} "
                f"{insumo.unidad}. Haz un ajuste a 0 primero"
            )
        recetas = db.scalars(
            select(models.Receta)
            .join(models.RecetaIngrediente)
            .where(
                models.RecetaIngrediente.insumo_id == insumo_id,
                models.Receta.activo.is_(True),
            )
        ).all()
        if recetas:
            nombres = ", ".join(r.nombre for r in recetas)
            raise ErrorDeNegocio(
                f"No se puede desactivar: lo usan estas recetas activas: {nombres}"
            )

    insumo.activo = activo
    db.commit()
    db.refresh(insumo)
    return insumo


def cambiar_activo_producto(
    db: Session, producto_id: int, activo: bool
) -> models.ProductoTerminado:
    producto = db.get(models.ProductoTerminado, producto_id)
    if producto is None:
        raise ErrorDeNegocio("El producto no existe")

    if not activo:
        if producto.stock_actual != 0:
            raise ErrorDeNegocio(
                f"No se puede desactivar: aún quedan {producto.stock_actual} "
                "unidades. Haz un ajuste a 0 primero"
            )
        recetas = db.scalars(
            select(models.Receta).where(
                models.Receta.producto_id == producto_id,
                models.Receta.activo.is_(True),
            )
        ).all()
        if recetas:
            nombres = ", ".join(r.nombre for r in recetas)
            raise ErrorDeNegocio(
                f"No se puede desactivar: lo generan estas recetas activas: {nombres}"
            )

    producto.activo = activo
    db.commit()
    db.refresh(producto)
    return producto

def editar_receta(
    db: Session,
    receta_id: int,
    nombre: str,
    producto_id: int | None,
    producto_nuevo,
    output_esperado: int,
    ingredientes: list,
) -> models.Receta:
    receta = db.get(models.Receta, receta_id)
    if receta is None:
        raise ErrorDeNegocio("La receta no existe")
    _validar_sin_produccion_en_curso(db, receta_id)

    otra = db.scalar(
        select(models.Receta).where(
            models.Receta.nombre == models.normalizar(nombre),
            models.Receta.id != receta_id,
        )
    )
    if otra is not None:
        raise ErrorDeNegocio(f"Ya existe otra receta llamada '{otra.nombre}'")

    _validar_ingredientes(db, ingredientes)
    producto = _resolver_producto(db, producto_id, producto_nuevo)

    receta.nombre = nombre
    receta.producto_id = producto.id
    receta.output_esperado = output_esperado

    receta.ingredientes.clear()
    db.flush()
    receta.ingredientes.extend(
        models.RecetaIngrediente(insumo_id=ing.insumo_id, cantidad=ing.cantidad)
        for ing in ingredientes
    )

    db.commit()
    db.refresh(receta)
    return receta


def cambiar_activo_receta(db: Session, receta_id: int, activo: bool) -> models.Receta:
    receta = db.get(models.Receta, receta_id)
    if receta is None:
        raise ErrorDeNegocio("La receta no existe")

    if not activo:
        _validar_sin_produccion_en_curso(db, receta_id)
    else:
        if not receta.producto.activo:
            raise ErrorDeNegocio(
                f"No se puede reactivar: el producto '{receta.producto.nombre}' "
                f"{receta.producto.gramaje} g está desactivado"
            )
        for ing in receta.ingredientes:
            if not ing.insumo.activo:
                raise ErrorDeNegocio(
                    f"No se puede reactivar: el insumo '{ing.insumo.nombre}' está desactivado"
                )

    receta.activo = activo
    db.commit()
    db.refresh(receta)
    return receta