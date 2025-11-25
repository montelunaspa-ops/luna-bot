// lunaRules.js
import { supabase } from "./supabase.js";

let cachedRules = null;
let lastLoad = 0;
const AUTO_RELOAD = 120000; // 2 minutos

export async function obtenerReglas() {
  const ahora = Date.now();

  // Usar versión cacheada si está fresca
  if (cachedRules && ahora - lastLoad < AUTO_RELOAD) {
    return cachedRules;
  }

  console.log("🔄 Descargando reglas desde la TABLA luna_rules…");

  const { data, error } = await supabase
    .from("luna_rules")
    .select("contenido")
    .single();

  if (error) {
    console.error("❌ Error al leer reglas desde la tabla:", error);
    return cachedRules || "Reglas no disponibles.";
  }

  cachedRules = data.contenido;
  lastLoad = ahora;

  console.log("✅ Reglas cargadas correctamente desde la tabla");
  return cachedRules;
}
