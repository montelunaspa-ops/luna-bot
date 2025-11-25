// lunaRules.js
import { supabase } from "./supabase.js";

let cachedRules = null;
let lastLoaded = 0;
const CACHE_MS = 60000; // 60 segundos

const FALLBACK_RULES = `
Eres Luna, asistente de Delicias Monte Luna.
Si no puedes cargar las reglas desde la base de datos, responde de forma segura:
- No inventes precios.
- No ofrezcas productos que no conozcas.
- Indica que no puedes acceder a toda la información y sugiere escribir por WhatsApp a un humano.
`;

// Función principal que usa index.js
export async function obtenerReglas() {
  const ahora = Date.now();

  // Si ya tenemos reglas recientes en memoria → usamos cache
  if (cachedRules && ahora - lastLoaded < CACHE_MS) {
    console.log("[LUNA RULES] Usando reglas cacheadas.");
    return cachedRules;
  }

  console.log("[LUNA RULES] Consultando reglas en tabla 'luna_rules'...");

  const { data, error } = await supabase
    .from("luna_rules")
    .select("contenido")
    .order("actualizado", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[LUNA RULES] Error al obtener reglas:", error.message);
    return cachedRules || FALLBACK_RULES;
  }

  if (!data || !data.contenido || data.contenido.trim().length < 20) {
    console.error("[LUNA RULES] Reglas vacías o muy cortas en DB. Usando fallback.");
    return cachedRules || FALLBACK_RULES;
  }

  cachedRules = data.contenido;
  lastLoaded = ahora;

  console.log("[LUNA RULES] Reglas cargadas correctamente. Longitud:", cachedRules.length);
  return cachedRules;
}
