import { supabase } from "./supabase.js";
import { guardarReglas, obtenerReglasCache, obtenerMomentoCarga } from "./rulesCache.js";

const BUCKET = "luna-rules";
const ARCHIVO = "luna_rules.txt";
const RELOAD_MS = 60000;

export async function cargarReglas(force = false) {
  const ultima = obtenerMomentoCarga();
  const ahora = Date.now();

  if (!force && ultima && ahora - ultima < RELOAD_MS && obtenerReglasCache()) {
    return obtenerReglasCache();
  }

  console.log("🔄 Descargando reglas desde Supabase…");

  const { data, error } = await supabase.storage.from(BUCKET).download(ARCHIVO);

  if (error) {
    console.error("❌ Error al descargar reglas:", error);
    return obtenerReglasCache() || "No se pudieron cargar las reglas.";
  }

  const texto = await data.text();
  guardarReglas(texto);

  console.log("✅ Reglas cargadas correctamente");

  return texto;
}

setInterval(() => cargarReglas(true), RELOAD_MS);
