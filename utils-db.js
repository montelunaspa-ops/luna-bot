const supabase = require("./supabase");

async function clienteExiste(phone, sb = supabase) {
  const { data, error } = await sb
    .from("clientes_detallados")
    .select("telefono")
    .eq("telefono", phone)
    .maybeSingle();

  if (error) {
    console.log("❌ Error verificando cliente:", error);
    return false;
  }

  return data ? true : false;
}

module.exports = { clienteExiste };
