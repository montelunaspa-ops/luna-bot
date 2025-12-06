const { supabase } = require("./supabase");

/* ===========================================================
   🟢 GUARDAR PEDIDO TEMPORAL (pedidos_temporales)
   =========================================================== */
async function guardarPedidoTemporal(telefono, pedido) {
  // Si ya existe un registro, lo actualizamos
  const { data: existente } = await supabase
    .from("pedidos_temporales")
    .select("id")
    .eq("telefono", telefono)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("pedidos_temporales")
      .update({
        pedido,
        actualizado_en: new Date().toISOString()
      })
      .eq("id", existente.id);

    if (error) console.error("❌ Error actualizando pedido temporal:", error);
    return;
  }

  // Si NO existe, lo creamos
  const { error } = await supabase
    .from("pedidos_temporales")
    .insert([
      {
        telefono,
        pedido,
      }
    ]);

  if (error) console.error("❌ Error guardando pedido temporal:", error);
}

/* ===========================================================
   🟢 GUARDAR CLIENTE NUEVO (clientes_detallados)
   =========================================================== */
async function guardarClienteNuevo(telefono, nombre, direccion, telefono2, comuna) {

  const { error } = await supabase
    .from("clientes_detallados")
    .insert([
      {
        telefono,
        nombre,
        direccion,
        telefono2,
        comuna,
      }
    ]);

  if (error) console.error("❌ Error guardando cliente nuevo:", error);
}

/* ===========================================================
   🟢 GUARDAR PEDIDO FINAL (pedidos)
   =========================================================== */
async function guardarPedidoCompleto(state) {
  const { error } = await supabase
    .from("pedidos")
    .insert([
      {
        telefono: state.phone,
        pedido: state.pedido,
        nombre: state.datos.nombre,
        direccion: state.datos.direccion,
        telefono2: state.datos.telefono2 || null,
        comuna: state.comuna,
        fecha_entrega: state.fechaEntrega,
        horario: state.horarioEntrega
      }
    ]);

  if (error) console.error("❌ Error guardando pedido final:", error);
}

module.exports = {
  guardarPedidoTemporal,
  guardarClienteNuevo,
  guardarPedidoCompleto
};
