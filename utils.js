const rules = require("./rules");

module.exports = {
  clienteExiste: async (phone, supabase) => {
    const { data } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("telefono", phone)
      .maybeSingle();

    return data || null;
  },

  comunaValida: (text) => {
    return rules.comunas_despacho.find(c =>
      c.toLowerCase() === text.toLowerCase()
    );
  }
};
