import { useState } from "react";
import Insumos from "./Insumos.jsx";
import Productos from "./Productos.jsx";
import Recetas from "./Recetas.jsx";
import Produccion from "./Produccion.jsx";
import "./App.css";
import Compras from "./Compras.jsx";
import Ventas from "./Ventas.jsx";

const PESTANAS = [
  { id: "insumos", titulo: "Insumos", Pantalla: Insumos },
  { id: "productos", titulo: "Productos terminados", Pantalla: Productos },
  { id: "recetas", titulo: "Recetas", Pantalla: Recetas },
  { id: "produccion", titulo: "Producción", Pantalla: Produccion },
  { id: "compras", titulo: "Compras", Pantalla: Compras },
  { id: "ventas", titulo: "Ventas", Pantalla: Ventas },
];

export default function App() {
  const [activa, setActiva] = useState("insumos");
  const { Pantalla } = PESTANAS.find((p) => p.id === activa);

  return (
    <main>
      <h1>Inventario Alimentos Veganos</h1>

      <nav className="pestanas">
        {PESTANAS.map((p) => (
          <button
            key={p.id}
            className={activa === p.id ? "activa" : ""}
            onClick={() => setActiva(p.id)}
          >
            {p.titulo}
          </button>
        ))}
      </nav>

      <Pantalla />
    </main>
  );
}

