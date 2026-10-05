import { useEffect, useRef, useState } from "react";
import { pedir, formatear, formatearFecha } from "./api";

export default function Compras() {
  const [insumos, setInsumos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [insumoId, setInsumoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const selectInsumo = useRef(null);

  async function cargar() {
    try {
      const [i, m] = await Promise.all([
        pedir("/insumos?incluir_inactivos=true"),
        pedir("/movimientos"),
      ]);
      setInsumos(i);
      setCompras(m.filter((mov) => mov.tipo === "compra").slice(0, 10));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const activos = insumos.filter((i) => i.activo);
  const seleccionado = insumos.find((i) => i.id === Number(insumoId));
  const cantidadNum = Number(cantidad);

  function insumoDe(id) {
    return insumos.find((i) => i.id === id);
  }

  async function registrar(evento) {
    evento.preventDefault();
    setError("");
    setMensaje("");
    try {
      const insumo = await pedir("/compras", {
        method: "POST",
        body: JSON.stringify({ insumo_id: Number(insumoId), cantidad: cantidadNum }),
      });
      setMensaje(
        `Compra registrada: +${formatear(cantidadNum)} ${insumo.unidad} de ${insumo.nombre}. ` +
          `Stock actual: ${formatear(insumo.stock_actual)} ${insumo.unidad}.`
      );
      setInsumoId("");
      setCantidad("");
      await cargar();
      selectInsumo.current.focus();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      <h2>Compras de insumos</h2>

      <form onSubmit={registrar} className="formulario">
        <label>
          Insumo
          <select
            ref={selectInsumo}
            value={insumoId}
            onChange={(e) => setInsumoId(e.target.value)}
            required
          >
            <option value="" disabled>
              Elige un insumo
            </option>
            {activos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cantidad comprada {seleccionado ? `(${seleccionado.unidad})` : ""}
          <input
            type="number"
            min="0"
            step="any"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={!seleccionado || !(cantidadNum > 0)}>
          Registrar compra
        </button>
      </form>

      {seleccionado && (
        <p className="nota">
          Stock actual de {seleccionado.nombre}: {formatear(seleccionado.stock_actual)}{" "}
          {seleccionado.unidad}
        </p>
      )}

      {mensaje && <p className="exito">{mensaje}</p>}
      {error && <p className="error">{error}</p>}

      <h3>Últimas compras</h3>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Insumo</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {compras.map((c) => {
            const insumo = insumoDe(c.insumo_id);
            return (
              <tr key={c.id}>
                <td>{formatearFecha(c.fecha)}</td>
                <td>{insumo ? insumo.nombre : "(desconocido)"}</td>
                <td>
                  +{formatear(c.cantidad)} {insumo ? insumo.unidad : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}