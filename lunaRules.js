import { cargarReglas } from "./rulesLoader.js";

export async function obtenerReglas() {
  return await cargarReglas();
}
