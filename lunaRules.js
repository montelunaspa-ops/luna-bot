// lunaRules.js
import { supabase } from "./supabase.js";

let cachedRules = null;
let lastLoadTime = 0;

// Cargar reglas desde Supabase Storage
export async function getLunaRules() {
  try {
    const now = Date.now();

    // Recarga automática cada 2 minutos
    if (cachedRules && now - lastLoadTime < 120000) {
      return cachedRules;
    }

    console.log("🔄 Cargando reglas desde Supabase...");

    const { data, error } = await supabase.storage
      .from("luna-rules")
      .download("luna rules.txt"); // archivo en la raíz del bucket

    if (error) {
      console.error("❌ Error cargando reglas:", error);
      return cachedRules ?? "ERROR: No se pudieron cargar las reglas.";
    }

    const text = await data.text();

    cachedRules = text;
    lastLoadTime = now;

    console.log("✅ Reglas cargadas correctamente");
    return text;

  } catch (err) {
    console.error("❌ Error inesperado cargando reglas:", err);
    return cachedRules ?? "ERROR: No se pudieron cargar las reglas.";
  }
}
