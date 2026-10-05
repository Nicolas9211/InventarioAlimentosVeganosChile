import { useEffect, useRef, useState } from "react";
import { pedir, formatear } from "./api";

const FORMULARIO_VACIO = { nombre: "", unidad: "g", stock_inicial: "", stock_ideal: "" };

export default function Insumos() {
  const [insumos, setInsumos] = useState([]);
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [error, setError] = useState("");
  const inputNombre = useRef(null);

  async function cargar() {
    try {
      setInsumos(await pedir(`/insumos?incluir_inactivos=${mostrarInactivos}`));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, [mostrarInactivos]);

  function cambiar(campo, valor) {
    setForm({ ...form, [campo]: valor });
  }

  function iniciarEdicion(insumo) {
    setError("");
    setEditandoId(insumo.id);
    setForm({
      nombre: insumo.nombre,
      unidad: insumo.unidad,
      stock_inicial: String(insumo.stock_actual),
      stock_ideal: String(insumo.stock_ideal),
    });
    inputNombre.current.focus();
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORMULARIO_VACIO);
  }

  async function guardar(evento) {
    evento.preventDefault();
    setError("");
    try {
      if (editandoId) {
        await pedir(`/insumos/${editandoId}`, {
          method: "PUT",
          body: JSON.stringify({
            nombre: form.nombre,
            stock_ideal: Number(form.stock_ideal) || 0,
          }),
        });
        setEditandoId(null);
        setForm(FORMULARIO_VACIO);
      } else {
        await pedir("/insumos", {
          method: "POST",
          body: JSON.stringify({
            nombre: form.nombre,
            unidad: form.unidad,
            stock_inicial: Number(form.stock_inicial) || 0,
            stock_ideal: Number(form.stock_ideal) || 0,
          }),
        });
        setForm({ ...FORMULARIO_VACIO, unidad: form.unidad });
      }
      await cargar();
      inputNombre.current.focus();
    } catch (e) {
      setError(e.message);
    }
  }

  async function ajustar(insumo) {
    const respuesta = window.prompt(
      `Stock real de "${insumo.nombre}" en ${insumo.unidad} (ahora: ${formatear(insumo.stock_actual)})`
    );
    if (respuesta === null || respuesta.trim() === "") return;

    const valor = Number(respuesta.replace(",", "."));
    if (Number.isNaN(valor) || valor < 0) {
      setError("Ingresa un número válido (0 o mayor)");
      return;
    }

    setError("");
    try {
      await pedir("/ajustes/insumo", {
        method: "POST",
        body: JSON.stringify({
          insumo_id: insumo.id,
          stock_real: valor,
          nota: "ajuste manual",
        }),
      });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cambiarActivo(insumo, activo) {
    if (!activo && !window.confirm(`¿Desactivar "${insumo.nombre}"?`)) return;
    setError("");
    try {
      await pedir(`/insumos/${insumo.id}/activo`, {
        method: "PATCH",
        body: JSON.stringify({ activo }),
      });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      <h2>Insumos</h2>

      <form onSubmit={guardar} className="formulario">
        <label>
          Nombre
          <input
            ref={inputNombre}
            value={form.nombre}
            onChange={(e) => cambiar("nombre", e.target.value)}
            required
          />
        </label>
        <label>
          Unidad
          <select
            value={form.unidad}
            onChange={(e) => cambiar("unidad", e.target.value)}
            disabled={editandoId !== null}
          >
            <option value="g">gramos (g)</option>
            <option value="ml">mililitros (ml)</option>
          </select>
        </label>
        <label>
          Stock actual
          <input
            type="number"
            min="0"
            step="any"
            value={form.stock_inicial}
            onChange={(e) => cambiar("stock_inicial", e.target.value)}
            disabled={editandoId !== null}
          />
        </label>
        <label>
          Stock ideal
          <input
            type="number"
            min="0"
            step="any"
            value={form.stock_ideal}
            onChange={(e) => cambiar("stock_ideal", e.target.value)}
          />
        </label>
        <button type="submit">{editandoId ? "Guardar cambios" : "Agregar"}</button>
        {editandoId && (
          <button type="button" className="secundario" onClick={cancelarEdicion}>
            Cancelar
          </button>
        )}
      </form>

      {editandoId && (
        <p className="nota">
          Editando. La unidad y el stock no se cambian aquí: para corregir el stock usa
          "Ajustar stock" en la tabla.
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="opciones">
        <label>
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
          />
          Mostrar desactivados
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Unidad</th>
            <th>Stock actual</th>
            <th>Stock ideal</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {insumos.map((insumo) => (
            <tr key={insumo.id} className={insumo.activo ? "" : "inactivo"}>
              <td>{insumo.nombre}</td>
              <td>{insumo.unidad}</td>
              <td>{formatear(insumo.stock_actual)}</td>
              <td>{formatear(insumo.stock_ideal)}</td>
              <td>
                <div className="acciones">
                  {insumo.activo ? (
                    <>
                      <button className="chico secundario" onClick={() => iniciarEdicion(insumo)}>
                        Editar
                      </button>
                      <button className="chico secundario" onClick={() => ajustar(insumo)}>
                        Ajustar stock
                      </button>
                      <button
                        className="chico secundario"
                        onClick={() => cambiarActivo(insumo, false)}
                      >
                        Desactivar
                      </button>
                    </>
                  ) : (
                    <button className="chico secundario" onClick={() => cambiarActivo(insumo, true)}>
                      Reactivar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}