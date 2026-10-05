import { useEffect, useState } from "react";
import { pedir, formatear } from "./api";

function formatearFecha(texto) {
  return new Date(texto).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

export default function Produccion() {
  const [recetas, setRecetas] = useState([]);
  const [producciones, setProducciones] = useState([]);
  const [recetaId, setRecetaId] = useState("");
  const [lotes, setLotes] = useState("1");
  const [obtenidas, setObtenidas] = useState({});
  const [error, setError] = useState("");

  async function cargar() {
    try {
      const [r, p] = await Promise.all([pedir("/recetas"), pedir("/producciones")]);
      setRecetas(r);
      setProducciones(p);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  const receta = recetas.find((r) => r.id === Number(recetaId));
  const cantidadLotes = Number(lotes);

  const necesidades = receta
    ? receta.ingredientes.map((ing) => ({
        id: ing.insumo.id,
        nombre: ing.insumo.nombre,
        unidad: ing.insumo.unidad,
        necesario: ing.cantidad * (cantidadLotes > 0 ? cantidadLotes : 0),
        disponible: ing.insumo.stock_actual,
      }))
    : [];
  const hayFaltantes = necesidades.some((n) => n.disponible < n.necesario);

  const enPreparacion = producciones.filter((p) => p.estado === "en_preparacion");
  const terminadas = producciones.filter((p) => p.estado === "terminada").slice(0, 10);

  function esperadoDe(produccion) {
    return Math.round(produccion.receta.output_esperado * produccion.lotes);
  }

  function valorObtenido(produccion) {
    return obtenidas[produccion.id] !== undefined
      ? obtenidas[produccion.id]
      : String(esperadoDe(produccion));
  }

  async function iniciar(evento) {
    evento.preventDefault();
    setError("");
    try {
      await pedir("/producciones", {
        method: "POST",
        body: JSON.stringify({ receta_id: Number(recetaId), lotes: cantidadLotes }),
      });
      setRecetaId("");
      setLotes("1");
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function terminar(produccion) {
    const texto = valorObtenido(produccion);
    const valor = Number(texto);
    if (texto === "" || !Number.isInteger(valor) || valor < 0) {
      setError("La cantidad obtenida debe ser un número entero (0 o mayor)");
      return;
    }
    if (
      valor === 0 &&
      !window.confirm(
        "¿Terminar sin obtener ninguna unidad? Los insumos ya descontados no se devuelven."
      )
    ) {
      return;
    }

    setError("");
    try {
      await pedir(`/producciones/${produccion.id}/terminar`, {
        method: "POST",
        body: JSON.stringify({ cantidad_obtenida: valor }),
      });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      <h2>Producción</h2>

      <h3>Iniciar producción</h3>
      <form onSubmit={iniciar} className="formulario">
        <label>
          Receta
          <select value={recetaId} onChange={(e) => setRecetaId(e.target.value)} required>
            <option value="" disabled>
              Elige una receta
            </option>
            {recetas.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Lotes
          <input
            type="number"
            min="0"
            step="any"
            value={lotes}
            onChange={(e) => setLotes(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={!receta || !(cantidadLotes > 0) || hayFaltantes}>
          Iniciar producción
        </button>
      </form>

      {receta && (
        <div className="vista-previa">
          <p>
            Rinde normalmente {receta.output_esperado} × {receta.producto.nombre}{" "}
            {receta.producto.gramaje} g por lote.
          </p>
          <table>
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Se descontará</th>
                <th>Disponible</th>
              </tr>
            </thead>
            <tbody>
              {necesidades.map((n) => (
                <tr key={n.id} className={n.disponible < n.necesario ? "falta" : ""}>
                  <td>{n.nombre}</td>
                  <td>
                    {formatear(n.necesario)} {n.unidad}
                  </td>
                  <td>
                    {formatear(n.disponible)} {n.unidad}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hayFaltantes && (
            <p className="error">Faltan insumos: no se puede iniciar esta producción.</p>
          )}
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <h3>En preparación</h3>
      {enPreparacion.length === 0 && <p className="nota">No hay producciones en preparación.</p>}
      {enPreparacion.map((p) => (
        <div key={p.id} className="tarjeta">
          <div className="detalle">
            <strong>{p.receta.nombre}</strong> · {formatear(p.lotes)} lote(s)
            <br />
            <span className="nota">
              Iniciada {formatearFecha(p.fecha_inicio)} · Esperado: {esperadoDe(p)} ×{" "}
              {p.receta.producto.nombre} {p.receta.producto.gramaje} g
            </span>
          </div>
          <label className="obtenida">
            Cantidad obtenida
            <input
              type="number"
              min="0"
              step="1"
              value={valorObtenido(p)}
              onChange={(e) => setObtenidas({ ...obtenidas, [p.id]: e.target.value })}
            />
          </label>
          <button onClick={() => terminar(p)}>Terminar</button>
        </div>
      ))}

      <h3>Últimas terminadas</h3>
      <table>
        <thead>
          <tr>
            <th>Receta</th>
            <th>Lotes</th>
            <th>Esperado</th>
            <th>Obtenido</th>
            <th>Terminada</th>
          </tr>
        </thead>
        <tbody>
          {terminadas.map((p) => (
            <tr key={p.id}>
              <td>{p.receta.nombre}</td>
              <td>{formatear(p.lotes)}</td>
              <td>
                {esperadoDe(p)} × {p.receta.producto.nombre} {p.receta.producto.gramaje} g
              </td>
              <td>{p.cantidad_obtenida}</td>
              <td>{formatearFecha(p.fecha_fin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}