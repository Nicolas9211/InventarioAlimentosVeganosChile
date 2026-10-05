import { useEffect, useRef, useState } from "react";
import { pedir } from "./api";

const INGREDIENTE_VACIO = { insumo_id: "", cantidad: "" };
const PRODUCTO_NUEVO_VACIO = { nombre: "", gramaje: "", stock_ideal: "" };

export default function Recetas() {
  const [recetas, setRecetas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);

  const [nombre, setNombre] = useState("");
  const [productoId, setProductoId] = useState("");
  const [productoNuevo, setProductoNuevo] = useState(PRODUCTO_NUEVO_VACIO);
  const [output, setOutput] = useState("");
  const [ingredientes, setIngredientes] = useState([{ ...INGREDIENTE_VACIO }]);

  const [editandoId, setEditandoId] = useState(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [error, setError] = useState("");
  const inputNombre = useRef(null);

  async function cargar() {
    try {
      const [r, i, p] = await Promise.all([
        pedir(`/recetas?incluir_inactivos=${mostrarInactivos}`),
        pedir("/insumos"),
        pedir("/productos"),
      ]);
      setRecetas(r);
      setInsumos(i);
      setProductos(p);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    cargar();
  }, [mostrarInactivos]);

  function limpiarFormulario() {
    setEditandoId(null);
    setNombre("");
    setProductoId("");
    setProductoNuevo(PRODUCTO_NUEVO_VACIO);
    setOutput("");
    setIngredientes([{ ...INGREDIENTE_VACIO }]);
  }

  function iniciarEdicion(receta) {
    setError("");
    setEditandoId(receta.id);
    setNombre(receta.nombre);
    setProductoId(String(receta.producto.id));
    setProductoNuevo(PRODUCTO_NUEVO_VACIO);
    setOutput(String(receta.output_esperado));
    setIngredientes(
      receta.ingredientes.map((ing) => ({
        insumo_id: String(ing.insumo.id),
        cantidad: String(ing.cantidad),
      }))
    );
    inputNombre.current.focus();
  }

  function cambiarIngrediente(indice, campo, valor) {
    setIngredientes(
      ingredientes.map((ing, i) => (i === indice ? { ...ing, [campo]: valor } : ing))
    );
  }

  function agregarIngrediente() {
    setIngredientes([...ingredientes, { ...INGREDIENTE_VACIO }]);
  }

  function quitarIngrediente(indice) {
    setIngredientes(ingredientes.filter((_, i) => i !== indice));
  }

  function unidadDe(insumoId) {
    const insumo = insumos.find((i) => i.id === Number(insumoId));
    return insumo ? insumo.unidad : "";
  }

  async function guardar(evento) {
    evento.preventDefault();
    setError("");

    const cuerpo = {
      nombre,
      output_esperado: Number(output),
      ingredientes: ingredientes.map((ing) => ({
        insumo_id: Number(ing.insumo_id),
        cantidad: Number(ing.cantidad),
      })),
      ...(productoId === "nuevo"
        ? {
            producto_nuevo: {
              nombre: productoNuevo.nombre,
              gramaje: Number(productoNuevo.gramaje),
              stock_ideal: Number(productoNuevo.stock_ideal) || 0,
            },
          }
        : { producto_id: Number(productoId) }),
    };

    try {
      if (editandoId) {
        await pedir(`/recetas/${editandoId}`, { method: "PUT", body: JSON.stringify(cuerpo) });
      } else {
        await pedir("/recetas", { method: "POST", body: JSON.stringify(cuerpo) });
      }
      limpiarFormulario();
      await cargar();
      inputNombre.current.focus();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cambiarActivo(receta, activo) {
    if (!activo && !window.confirm(`¿Desactivar la receta "${receta.nombre}"?`)) return;
    setError("");
    try {
      await pedir(`/recetas/${receta.id}/activo`, {
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
      <h2>Recetas</h2>

      <form onSubmit={guardar}>
        <div className="formulario">
          <label>
            Nombre de la receta
            <input
              ref={inputNombre}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </label>
          <label>
            Producto que genera
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)} required>
              <option value="" disabled>
                Elige un producto
              </option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.gramaje} g
                </option>
              ))}
              <option value="nuevo">+ Crear producto nuevo…</option>
            </select>
          </label>
          <label>
            Rinde (unidades)
            <input
              type="number"
              min="1"
              step="1"
              value={output}
              onChange={(e) => setOutput(e.target.value)}
              required
            />
          </label>
        </div>

        {productoId === "nuevo" && (
          <div className="formulario bloque-nuevo">
            <label>
              Nombre del producto nuevo
              <input
                value={productoNuevo.nombre}
                onChange={(e) => setProductoNuevo({ ...productoNuevo, nombre: e.target.value })}
                required
              />
            </label>
            <label>
              Gramaje (g)
              <input
                type="number"
                min="0"
                step="any"
                value={productoNuevo.gramaje}
                onChange={(e) => setProductoNuevo({ ...productoNuevo, gramaje: e.target.value })}
                required
              />
            </label>
            <label>
              Stock ideal (unidades)
              <input
                type="number"
                min="0"
                step="1"
                value={productoNuevo.stock_ideal}
                onChange={(e) =>
                  setProductoNuevo({ ...productoNuevo, stock_ideal: e.target.value })
                }
              />
            </label>
          </div>
        )}

        <h3>Ingredientes</h3>
        <div className="ingredientes">
          {ingredientes.map((ing, indice) => (
            <div key={indice} className="ingrediente-fila">
              <select
                value={ing.insumo_id}
                onChange={(e) => cambiarIngrediente(indice, "insumo_id", e.target.value)}
                required
              >
                <option value="" disabled>
                  Elige un insumo
                </option>
                {insumos.map((insumo) => (
                  <option
                    key={insumo.id}
                    value={insumo.id}
                    disabled={ingredientes.some(
                      (otro, j) => j !== indice && otro.insumo_id === String(insumo.id)
                    )}
                  >
                    {insumo.nombre}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Cantidad"
                value={ing.cantidad}
                onChange={(e) => cambiarIngrediente(indice, "cantidad", e.target.value)}
                required
              />
              <span>{unidadDe(ing.insumo_id)}</span>
              <button
                type="button"
                className="secundario"
                onClick={() => quitarIngrediente(indice)}
                disabled={ingredientes.length === 1}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>

        <div className="formulario">
          <button type="button" className="secundario" onClick={agregarIngrediente}>
            + Agregar ingrediente
          </button>
          <button type="submit">{editandoId ? "Guardar cambios" : "Guardar receta"}</button>
          {editandoId && (
            <button type="button" className="secundario" onClick={limpiarFormulario}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="opciones">
        <label>
          <input
            type="checkbox"
            checked={mostrarInactivos}
            onChange={(e) => setMostrarInactivos(e.target.checked)}
          />
          Mostrar desactivadas
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Receta</th>
            <th>Rinde</th>
            <th>Ingredientes</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {recetas.map((receta) => (
            <tr key={receta.id} className={receta.activo ? "" : "inactivo"}>
              <td>{receta.nombre}</td>
              <td>
                {receta.output_esperado} × {receta.producto.nombre} {receta.producto.gramaje} g
              </td>
              <td>
                <ul>
                  {receta.ingredientes.map((ing) => (
                    <li key={ing.insumo.id}>
                      {ing.insumo.nombre}: {ing.cantidad} {ing.insumo.unidad}
                    </li>
                  ))}
                </ul>
              </td>
              <td>
                <div className="acciones">
                  {receta.activo ? (
                    <>
                      <button className="chico secundario" onClick={() => iniciarEdicion(receta)}>
                        Editar
                      </button>
                      <button
                        className="chico secundario"
                        onClick={() => cambiarActivo(receta, false)}
                      >
                        Desactivar
                      </button>
                    </>
                  ) : (
                    <button className="chico secundario" onClick={() => cambiarActivo(receta, true)}>
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