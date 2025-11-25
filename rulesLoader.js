// rulesLoader.js
import { supabase } from "./supabase.js";
import { guardarReglas, obtenerReglasCache, obtenerMomentoCarga } from "./rulesCache.js";

const RELOAD_MS = 60000; // 1 minuto

export async function cargarReglas(force = false) {
  const ultima = obtenerMomentoCarga();
  const ahora = Date.now();

  // Usar cache si está fresca
  if (!force && ultima && ahora - ultima < RELOAD_MS && obtenerReglasCache()) {
    return obtenerReglasCache();
  }

  console.log("🔄 Descargando reglas desde TABLA luna_rules…");

  const { data, error } = await supabase
    .from("luna_rules")        // 👈 TABLA, no bucket
    .select("contenido")       // 👈 Campo donde guardas el texto
    .single();

  if (error) {
    console.error("❌ Error al leer reglas desde tabla:", error);
    return obtenerReglasCache() || "Reglas no disponibles.";
  }

  const texto = data.contenido;

  guardarReglas(texto);

  console.log("✅ Reglas cargadas correctamente desde la tabla");

  return texto;
}

// Recarga automática
setInterval(() => cargarReglas(true), RELOAD_MS);
