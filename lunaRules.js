// lunaRules.js
import { supabase } from "./supabase.js";

let cachedRules = null;
let lastLoad = 0;
const AUTO_RELOAD = 120000; // 2 minutos

export async function obtenerReglas() {
  const ahora = Date.now();

  // Evita recargar a cada rato
  if (cachedRules && (ahora - lastLoad) < AUTO_RELOAD) {
    return cachedRules;
  }

  console.log("🔄 Leyendo reglas desde tabla luna_rules…");

  const { data, error } = await supabase
    .from("luna_rules")
    .select("contenido")
    .order("id", { ascending: false }) // siempre obtiene la versión más reciente
    .limit(1)
    .single();

  if (error) {
    console.error("❌ Error cargando reglas desde tabla:", error);
    return cachedRules || "Reglas no disponibles.";
  }

  cachedRules = data.contenido;
  lastLoad = ahora;

  console.log("✅ Reglas cargadas correctamente (tabla)");
  return cachedRules;
}
