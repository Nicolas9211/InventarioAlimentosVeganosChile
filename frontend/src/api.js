const URL_API = "http://127.0.0.1:8000";

function mensajeDeError(datos) {
  if (typeof datos.detail === "string") return datos.detail;
  if (Array.isArray(datos.detail)) return datos.detail.map((e) => e.msg).join("; ");
  return "Error desconocido";
}

export async function pedir(ruta, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(URL_API + ruta, {
      headers: { "Content-Type": "application/json" },
      ...opciones,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor. ¿Está encendido el backend?");
  }

  const datos = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(mensajeDeError(datos));
  }
  return datos;
}

export function formatear(numero) {
  return numero.toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

export function formatearFecha(texto) {
  return new Date(texto).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}