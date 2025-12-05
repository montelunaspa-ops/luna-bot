const supabase = require("./supabase");

/* ⚡ GUARDAR CLIENTE NUEVO */
async function guardarClienteNuevo(phone, nombre, direccion, telefono2, comuna) {
  const { error } = await supabase
    .from("clientes_detallados")
    .insert({
      telefono: phone,
      nombre,
      direccion,
      telefono2,
      comuna,
      creado_en: new Date().toISOString()
    });

  if (error) console.log("❌ Error guardando cliente:", error);
  return true;
}

/* ⚡ GUARDAR CADA MENSAJE (HISTORIAL) */
async function guardarHistorial(phone, mensaje, tipo = "cliente") {
  const { error } = await supabase
    .from("historial")
    .insert({
      telefono: phone,
      mensaje,
      tipo, // cliente | bot
      fecha: new Date().toISOString()
    });

  if (error) console.log("❌ Error guardando historial:", error);
}

/* ⚡ GUARDAR PEDIDO TEMPORAL */
async function guardarPedidoTemporal(phone, pedidoArray) {
  const { error } = await supabase
    .from("pedidos")
    .upsert({
      telefono: phone,
      pedido: pedidoArray,
      actualizado_en: new Date().toISOString()
    });

  if (error) console.log("❌ Error guardando pedido temporal:", error);
}

/* ⚡ GUARDAR PEDIDO COMPLETO */
async function guardarPedidoCompleto(state) {
  const { error } = await supabase
    .from("pedidos_completos")
    .insert({
      telefono: state.phone,
      pedido: state.pedido,
      nombre: state.datos.nombre,
      direccion: state.datos.direccion,
      telefono2: state.datos.telefono2 || state.phone,
      comuna: state.comuna,
      fecha_entrega: state.fechaEntrega,
      horario: state.horarioEntrega,
      entrega: state.entrega,
      creado_en: new Date().toISOString()
    });

  if (error) console.log("❌ Error guardando pedido completo:", error);
  return true;
}

module.exports = {
  guardarClienteNuevo,
  guardarHistorial,
  guardarPedidoTemporal,
  guardarPedidoCompleto
};
