// lunaRules.js
import { supabase } from "./supabase.js";

let cachedRules = null;
let lastLoad = 0;
const AUTO_RELOAD = 120000; // 2 minutos

export async function obtenerReglas() {
  const ahora = Date.now();

  if (cachedRules && ahora - lastLoad < AUTO_RELOAD) {
    return cachedRules;
  }

  console.log("🔄 Cargando reglas desde Supabase…");

  const { data, error } = await supabase.storage
    .from("luna-rules")
    .download("luna_rules.txt");

  if (error) {
    console.error("❌ Error cargando reglas:", error);
    return cachedRules || "Reglas no disponibles.";
  }

  const text = await data.text();

  cachedRules = text;
  lastLoad = ahora;

  console.log("✅ Reglas cargadas correctamente");
  return text;
}
