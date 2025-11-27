// =========================
//     rulesLoader.js
// =========================

import { supabase } from "./supabase.js";
import {
  guardarReglas,
  obtenerReglasCache,
  obtenerMomentoCarga
} from "./rulesCache.js";

const RELOAD_MS = 60000; // 1 minuto

export async function cargarReglas(force = false) {
  const ultima = obtenerMomentoCarga();
  const ahora = Date.now();

  if (!force && ultima && ahora - ultima < RELOAD_MS && obtenerReglasCache()) {
    return obtenerReglasCache();
  }

  console.log("🔄 Descargando reglas desde tabla luna_rules…");

  const { data, error } = await supabase
    .from("luna_rules")
    .select("contenido")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("❌ Error al cargar reglas:", error);
    return obtenerReglasCache() || "ERROR: reglas no disponibles.";
  }

  guardarReglas(data.contenido);

  console.log("✅ Reglas actualizadas");
  return data.contenido;
}

// Recarga automática
setInterval(() => cargarReglas(true), RELOAD_MS);
