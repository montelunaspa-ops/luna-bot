import { supabase } from "./supabase.js";

export async function obtenerReglasDesdeDB() {
  const { data, error } = await supabase
    .from("luna_rules")
    .select("contenido")
    .eq("id", 1)
    .single();

  if (error) {
    console.error("❌ No se pudieron cargar reglas:", error);
    return "";
  }

  return data.contenido;
}
