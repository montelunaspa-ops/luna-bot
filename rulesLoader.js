import { obtenerReglasDesdeDB } from "./lunaRules.js";
import { guardarReglas, obtenerReglasCache, obtenerMomentoCarga } from "./rulesCache.js";

const RELOAD_MS = 60000;

export async function cargarReglas(force = false) {
  const last = obtenerMomentoCarga();
  const now = Date.now();

  if (!force && last && now - last < RELOAD_MS && obtenerReglasCache()) {
    return obtenerReglasCache();
  }

  console.log("🔄 Descargando reglas desde tabla luna_rules…");

  const reglas = await obtenerReglasDesdeDB();
  guardarReglas(reglas);

  console.log("✅ Reglas actualizadas");

  return reglas;
}

setInterval(() => cargarReglas(true), RELOAD_MS);
