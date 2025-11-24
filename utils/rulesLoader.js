// /utils/rulesLoader.js
import { supabase } from "../supabaseClient.js";

let cachedRules = null;
let lastLoadTime = 0;
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutos

export async function getRules() {
  const now = Date.now();

  // Si las reglas están cargadas y no ha pasado el tiempo de recarga → devuelve cache
  if (cachedRules && now - lastLoadTime < REFRESH_INTERVAL) {
    return cachedRules;
  }

  try {
    // Descargar archivo desde Supabase Storage
    const { data, error } = await supabase
      .storage
      .from("rules")
      .download("luna rules.txt");

    if (error) throw error;

    const text = await data.text();

    // Guardamos en memoria
    cachedRules = text;
    lastLoadTime = now;

    return cachedRules;

  } catch (err) {
    console.error("❌ Error al cargar reglas:", err);

    // Protección: si falla, devolver la última versión que funcionaba
    if (cachedRules) {
      console.warn("⚠️ Usando versión anterior de reglas (modo seguro)");
      return cachedRules;
    }

    // Si no existe ninguna versión previa, devolvemos reglas mínimas
    return "Reglas temporales: Luna asistente virtual.";
  }
}
