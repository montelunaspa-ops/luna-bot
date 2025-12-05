const supabase = require("./supabase");

async function clienteExiste(phone) {
  try {
    const { data, error } = await supabase
      .from("clientes_detallados")
      .select("telefono")
      .eq("telefono", phone)
      .maybeSingle();

    if (error) {
      console.log("❌ Error verificando cliente en DB:", error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.log("❌ Error inesperado en clienteExiste:", err);
    return false;
  }
}

async function obtenerCliente(phone) {
  try {
    const { data, error } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("telefono", phone)
      .maybeSingle();

    if (error) {
      console.log("❌ Error obteniendo cliente:", error);
      return null;
    }

    return data;
  } catch (err) {
    console.log("❌ Error inesperado en obtenerCliente:", err);
    return null;
  }
}

module.exports = {
  clienteExiste,
  obtenerCliente
};
