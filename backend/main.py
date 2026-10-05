from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

import models
import schemas
import servicios
from database import Base, engine, get_db
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

import respaldo

Base.metadata.create_all(bind=engine)
@asynccontextmanager
async def ciclo_de_vida(app: FastAPI):
    # Esto se ejecuta una vez, al arrancar el servidor
    try:
        ruta = respaldo.hacer_respaldo()
        if ruta:
            print(f"Respaldo creado: {ruta}")
    except Exception as error:
        print(f"No se pudo crear el respaldo: {error}")
    yield


app = FastAPI(title="Inventario Alimentos Veganos", lifespan=ciclo_de_vida)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def inicio():
    return {"mensaje": "El servidor funciona"}


@app.post("/insumos", response_model=schemas.InsumoSalida)
def crear_insumo(datos: schemas.InsumoCrear, db: Session = Depends(get_db)):
    try:
        return servicios.crear_insumo(
            db, datos.nombre, datos.unidad, datos.stock_inicial, datos.stock_ideal
        )
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/insumos", response_model=list[schemas.InsumoSalida])
def listar_insumos(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    consulta = select(models.Insumo).order_by(models.Insumo.nombre)
    if not incluir_inactivos:
        consulta = consulta.where(models.Insumo.activo.is_(True))
    return db.scalars(consulta).all()


@app.post("/productos", response_model=schemas.ProductoSalida)
def crear_producto(datos: schemas.ProductoCrear, db: Session = Depends(get_db)):
    try:
        return servicios.crear_producto(
            db, datos.nombre, datos.gramaje, datos.stock_inicial, datos.stock_ideal
        )
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/productos", response_model=list[schemas.ProductoSalida])
def listar_productos(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    consulta = select(models.ProductoTerminado).order_by(
        models.ProductoTerminado.nombre, models.ProductoTerminado.gramaje
    )
    if not incluir_inactivos:
        consulta = consulta.where(models.ProductoTerminado.activo.is_(True))
    return db.scalars(consulta).all()


@app.post("/recetas", response_model=schemas.RecetaSalida)
def crear_receta(datos: schemas.RecetaCrear, db: Session = Depends(get_db)):
    try:
        return servicios.crear_receta(
            db,
            datos.nombre,
            datos.producto_id,
            datos.producto_nuevo,
            datos.output_esperado,
            datos.ingredientes,
        )
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/recetas", response_model=list[schemas.RecetaSalida])
def listar_recetas(incluir_inactivos: bool = False, db: Session = Depends(get_db)):
    consulta = select(models.Receta).order_by(models.Receta.nombre)
    if not incluir_inactivos:
        consulta = consulta.where(models.Receta.activo.is_(True))
    return db.scalars(consulta).all()


@app.post("/producciones", response_model=schemas.ProduccionSalida)
def iniciar_produccion(datos: schemas.ProduccionIniciar, db: Session = Depends(get_db)):
    try:
        return servicios.iniciar_produccion(db, datos.receta_id, datos.lotes)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/producciones/{produccion_id}/terminar", response_model=schemas.ProduccionSalida)
def terminar_produccion(
    produccion_id: int, datos: schemas.ProduccionTerminar, db: Session = Depends(get_db)
):
    try:
        return servicios.terminar_produccion(db, produccion_id, datos.cantidad_obtenida)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/producciones", response_model=list[schemas.ProduccionSalida])
def listar_producciones(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Produccion).order_by(models.Produccion.fecha_inicio.desc())
    ).all()

@app.post("/compras", response_model=schemas.InsumoSalida)
def registrar_compra(datos: schemas.CompraCrear, db: Session = Depends(get_db)):
    try:
        return servicios.registrar_compra(db, datos.insumo_id, datos.cantidad)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/ventas", response_model=schemas.ProductoSalida)
def registrar_venta(datos: schemas.VentaCrear, db: Session = Depends(get_db)):
    try:
        return servicios.registrar_venta(db, datos.producto_id, datos.cantidad)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/ajustes/insumo", response_model=schemas.InsumoSalida)
def ajustar_insumo(datos: schemas.AjusteInsumo, db: Session = Depends(get_db)):
    try:
        return servicios.ajustar_insumo(db, datos.insumo_id, datos.stock_real, datos.nota)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/ajustes/producto", response_model=schemas.ProductoSalida)
def ajustar_producto(datos: schemas.AjusteProducto, db: Session = Depends(get_db)):
    try:
        return servicios.ajustar_producto(db, datos.producto_id, datos.stock_real, datos.nota)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/movimientos", response_model=list[schemas.MovimientoSalida])
def listar_movimientos(db: Session = Depends(get_db)):
    return db.scalars(
        select(models.Movimiento).order_by(models.Movimiento.fecha.desc())
    ).all()

@app.put("/insumos/{insumo_id}", response_model=schemas.InsumoSalida)
def editar_insumo(insumo_id: int, datos: schemas.InsumoEditar, db: Session = Depends(get_db)):
    try:
        return servicios.editar_insumo(db, insumo_id, datos.nombre, datos.stock_ideal)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.patch("/insumos/{insumo_id}/activo", response_model=schemas.InsumoSalida)
def cambiar_activo_insumo(
    insumo_id: int, datos: schemas.CambioActivo, db: Session = Depends(get_db)
):
    try:
        return servicios.cambiar_activo_insumo(db, insumo_id, datos.activo)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.put("/productos/{producto_id}", response_model=schemas.ProductoSalida)
def editar_producto(
    producto_id: int, datos: schemas.ProductoEditar, db: Session = Depends(get_db)
):
    try:
        return servicios.editar_producto(
            db, producto_id, datos.nombre, datos.gramaje, datos.stock_ideal
        )
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.patch("/productos/{producto_id}/activo", response_model=schemas.ProductoSalida)
def cambiar_activo_producto(
    producto_id: int, datos: schemas.CambioActivo, db: Session = Depends(get_db)
):
    try:
        return servicios.cambiar_activo_producto(db, producto_id, datos.activo)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))

@app.put("/recetas/{receta_id}", response_model=schemas.RecetaSalida)
def editar_receta(
    receta_id: int, datos: schemas.RecetaCrear, db: Session = Depends(get_db)
):
    try:
        return servicios.editar_receta(
            db,
            receta_id,
            datos.nombre,
            datos.producto_id,
            datos.producto_nuevo,
            datos.output_esperado,
            datos.ingredientes,
        )
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.patch("/recetas/{receta_id}/activo", response_model=schemas.RecetaSalida)
def cambiar_activo_receta(
    receta_id: int, datos: schemas.CambioActivo, db: Session = Depends(get_db)
):
    try:
        return servicios.cambiar_activo_receta(db, receta_id, datos.activo)
    except servicios.ErrorDeNegocio as error:
        raise HTTPException(status_code=400, detail=str(error))