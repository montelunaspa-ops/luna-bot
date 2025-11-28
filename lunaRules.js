// ===============================================
//  Cargar TODAS las reglas del negocio desde Supabase
// ===============================================

import { supabase } from "./supabaseClient.js";

export async function obtenerReglas() {
  const { data, error } = await supabase
    .from("luna_rules")
    .select("rule_key, rule_value");

  if (error) {
    console.error("❌ Error cargando reglas:", error);
    return {};
  }

  const reglas = {};
  data.forEach(r => reglas[r.rule_key] = r.rule_value);
  return reglas;
}
