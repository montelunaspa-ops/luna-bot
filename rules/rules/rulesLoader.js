// rules/rulesLoader.js
import { supabase } from "../supabase.js";
import { setRules, getRules, getLastLoaded } from "./rulesCache.js";

const FILE_PATH = "luna rules.txt";
const AUTO_RELOAD_MS = 60000; // 60 segundos

export async function loadRules(force = false) {
  const last = getLastLoaded();
  const now = Date.now();

  if (!force && last && now - last < AUTO_RELOAD_MS && getRules()) {
    return getRules();
  }

  console.log("[LUNA] Cargando reglas desde Bucket…");

  const { data, error } = await supabase
    .storage
    .from("public") // AJUSTA el nombre del bucket si es distinto
    .download(FILE_PATH);

  if (error) {
    console.error("[LUNA] Error al descargar reglas:", error.message);
    return getRules();
  }

  const text = await data.text();
  setRules(text);
  console.log("[LUNA] Reglas actualizadas");

  return text;
}

// Iniciar carga automática
setInterval(() => loadRules(true), AUTO_RELOAD_MS);
