// lunaRules.js
import { supabase } from "./supabase.js";

let reglasCache = null;
let ultimaCarga = 0;
const INTERVALO_MS = 5 * 60 * 1000; // 5 minutos

export async function obtenerReglas() {
  const ahora = Date.now();

  // Si han pasado menos de 5 minutos, usar cache
  if (reglasCache && (ahora - ultimaCarga < INTERVALO_MS)) {
    return reglasCache;
  }

  // Cargar desde Supabase
  const { data, error } = await supabase
    .storage
    .from("luna-rules")
    .download("luna rules.txt");

  if (error) {
    console.error("❌ Error cargando reglas:", error);
    return reglasCache || ""; // fallback
  }

  const texto = await data.text();

  reglasCache = texto;
  ultimaCarga = ahora;

  console.log("✔ Reglas cargadas desde Supabase");
  return texto;
}
