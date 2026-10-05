import { useEffect, useRef, useState } from "react";
import { pedir, formatear } from "./api";

const FORMULARIO_VACIO = { nombre: "", gramaje: "", stock_inicial: "", stock_ideal: "" };

export default function Productos() {
  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [editandoId, setEditandoId] = useState(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [error, setError] = useState("");
  const inputNombre = useRef(null);

  async function cargar() {
    try {
      setProductos(await pedir(`/productos?incluir_inactivos=${mostrarInactivos}`));
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

  function iniciarEdicion(producto) {
    setError("");
    setEditandoId(producto.id);
    setForm({
      nombre: producto.nombre,
      gramaje: String(producto.gramaje),
      stock_inicial: String(producto.stock_actual),
      stock_ideal: String(producto.stock_ideal),
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
        await pedir(`/productos/${editandoId}`, {
          method: "PUT",
          body: JSON.stringify({
            nombre: form.nombre,
            gramaje: Number(form.gramaje),
            stock_ideal: Number(form.stock_ideal) || 0,
          }),
        });
        setEditandoId(null);
      } else {
        await pedir("/productos", {
          method: "POST",
          body: JSON.stringify({
            nombre: form.nombre,
            gramaje: Number(form.gramaje),
            stock_inicial: Number(form.stock_inicial) || 0,
            stock_ideal: Number(form.stock_ideal) || 0,
          }),
        });
      }
      setForm(FORMULARIO_VACIO);
      await cargar();
      inputNombre.current.focus();
    } catch (e) {
      setError(e.message);
    }
  }

  async function ajustar(producto) {
    const respuesta = window.prompt(
      `Unidades reales de "${producto.nombre}" ${producto.gramaje} g (ahora: ${producto.stock_actual})`
    );
    if (respuesta === null || respuesta.trim() === "") return;

    const valor = Number(respuesta.replace(",", "."));
    if (!Number.isInteger(valor) || valor < 0) {
      setError("Ingresa un número entero (0 o mayor)");
      return;
    }

    setError("");
    try {
      await pedir("/ajustes/producto", {
        method: "POST",
        body: JSON.stringify({
          producto_id: producto.id,
          stock_real: valor,
          nota: "ajuste manual",
        }),
      });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cambiarActivo(producto, activo) {
    if (
      !activo &&
      !window.confirm(`¿Desactivar "${producto.nombre}" ${producto.gramaje} g?`)
    )
      return;
    setError("");
    try {
      await pedir(`/productos/${producto.id}/activo`, {
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
      <h2>Productos terminados</h2>

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
          Gramaje (g)
          <input
            type="number"
            min="0"
            step="any"
            value={form.gramaje}
            onChange={(e) => cambiar("gramaje", e.target.value)}
            required
          />
        </label>
        <label>
          Stock actual (unidades)
          <input
            type="number"
            min="0"
            step="1"
            value={form.stock_inicial}
            onChange={(e) => cambiar("stock_inicial", e.target.value)}
            disabled={editandoId !== null}
          />
        </label>
        <label>
          Stock ideal (unidades)
          <input
            type="number"
            min="0"
            step="1"
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
          Editando. El stock no se cambia aquí: para corregirlo usa "Ajustar stock" en la
          tabla.
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
            <th>Gramaje</th>
            <th>Stock actual</th>
            <th>Stock ideal</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((producto) => (
            <tr key={producto.id} className={producto.activo ? "" : "inactivo"}>
              <td>{producto.nombre}</td>
              <td>{formatear(producto.gramaje)} g</td>
              <td>{formatear(producto.stock_actual)}</td>
              <td>{formatear(producto.stock_ideal)}</td>
              <td>
                <div className="acciones">
                  {producto.activo ? (
                    <>
                      <button className="chico secundario" onClick={() => iniciarEdicion(producto)}>
                        Editar
                      </button>
                      <button className="chico secundario" onClick={() => ajustar(producto)}>
                        Ajustar stock
                      </button>
                      <button
                        className="chico secundario"
                        onClick={() => cambiarActivo(producto, false)}
                      >
                        Desactivar
                      </button>
                    </>
                  ) : (
                    <button
                      className="chico secundario"
                      onClick={() => cambiarActivo(producto, true)}
                    >
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