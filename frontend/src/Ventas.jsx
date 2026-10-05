import { useEffect, useRef, useState } from "react";
import { pedir, formatear, formatearFecha } from "./api";

export default function Ventas() {
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const selectProducto = useRef(null);

  async function cargar() {
    try {
      const [p, m] = await Promise.all([
        pedir("/productos?incluir_inactivos=true"),
        pedir("/movimientos"),
      ]);
      setProductos(p);
      setVentas(m.filter((mov) => mov.tipo === "venta").slice(0, 10));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const activos = productos.filter((p) => p.activo);
  const seleccionado = productos.find((p) => p.id === Number(productoId));
  const cantidadNum = Number(cantidad);
  const excede = seleccionado && cantidadNum > seleccionado.stock_actual;

  function productoDe(id) {
    return productos.find((p) => p.id === id);
  }

  async function registrar(evento) {
    evento.preventDefault();
    setError("");
    setMensaje("");
    try {
      const producto = await pedir("/ventas", {
        method: "POST",
        body: JSON.stringify({ producto_id: Number(productoId), cantidad: cantidadNum }),
      });
      setMensaje(
        `Venta registrada: ${cantidadNum} × ${producto.nombre} ${producto.gramaje} g. ` +
          `Quedan ${formatear(producto.stock_actual)} unidades.`
      );
      setProductoId("");
      setCantidad("");
      await cargar();
      selectProducto.current.focus();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      <h2>Ventas de productos terminados</h2>

      <form onSubmit={registrar} className="formulario">
        <label>
          Producto
          <select
            ref={selectProducto}
            value={productoId}
            onChange={(e) => setProductoId(e.target.value)}
            required
          >
            <option value="" disabled>
              Elige un producto
            </option>
            {activos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.gramaje} g ({formatear(p.stock_actual)} disp.)
              </option>
            ))}
          </select>
        </label>
        <label>
          Unidades vendidas
          <input
            type="number"
            min="1"
            step="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={!seleccionado || !Number.isInteger(cantidadNum) || cantidadNum < 1 || excede}
        >
          Registrar venta
        </button>
      </form>

      {seleccionado && (
        <p className={excede ? "error" : "nota"}>
          {excede
            ? `No hay suficiente stock: disponibles ${formatear(seleccionado.stock_actual)} unidades.`
            : `Disponibles: ${formatear(seleccionado.stock_actual)} unidades.`}
        </p>
      )}

      {mensaje && <p className="exito">{mensaje}</p>}
      {error && <p className="error">{error}</p>}

      <h3>Últimas ventas</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Producto</th>
            <th>Unidades</th>
          </tr>
        </thead>
        <tbody>
          {ventas.map((v) => {
            const producto = productoDe(v.producto_id);
            return (
              <tr key={v.id}>
                <td>{formatearFecha(v.fecha)}</td>
                <td>
                  {producto ? `${producto.nombre} ${producto.gramaje} g` : "(desconocido)"}
                </td>
                <td>{formatear(Math.abs(v.cantidad))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}