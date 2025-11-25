import { supabase } from "./supabase.js";
import { guardarReglas, obtenerReglasCache, obtenerMomentoCarga } from "./rulesCache.js";

const RELOAD_MS = 60000; // 1 minuto

export async function cargarReglas(force = false) {
  const ultima = obtenerMomentoCarga();
  const ahora = Date.now();

  if (!force && ultima && ahora - ultima < RELOAD_MS && obtenerReglasCache()) {
    return obtenerReglasCache();
  }

  console.log("🔄 Cargando reglas desde tabla luna_rules…");

  const { data, error } = await supabase
    .from("luna_rules")
    .select("contenido")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("❌ Error al leer reglas:", error);
    return obtenerReglasCache() || "Reglas no disponibles.";
  }

  guardarReglas(data.contenido);

  console.log("✅ Reglas cargadas correctamente");
  return data.contenido;
}

setInterval(() => cargarReglas(true), RELOAD_MS);
