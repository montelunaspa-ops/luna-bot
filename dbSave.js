const supabase = require("./supabase");

/* TEMPORAL: pedidos (solo pedido + telefono) */
async function guardarPedidoTemporal(telefono, pedido) {
  const { error } = await supabase
    .from("pedidos")
    .upsert(
      { telefono, pedido, actualizado_en: new Date() },
      { onConflict: "telefono" }
    );

  if (error) {
    console.error("❌ Error guardando pedido temporal:", error);
  }
}

/* CLIENTE NUEVO */
async function guardarClienteNuevo(telefono, nombre, direccion, telefono2, comuna) {
  const { error } = await supabase.from("clientes_detallados").upsert(
    {
      telefono,
      nombre,
      direccion,
      telefono2,
      comuna,
      creado_en: new Date()
    },
    { onConflict: "telefono" }
  );

  if (error) console.error("❌ Error guardando cliente:", error);
}

/* PEDIDO COMPLETO */
async function guardarPedidoCompleto(state) {
  const payload = {
    telefono: state.phone,
    pedido: state.pedido,
    nombre: state.datos.nombre,
    direccion: state.datos.direccion,
    telefono2: state.datos.telefono2,
    comuna: state.comuna,
    fecha_entrega: state.fechaEntrega,
    horario: state.horarioEntrega,
    creado_en: new Date()
  };

  const { error } = await supabase.from("pedidos_completos").insert(payload);

  if (error) console.error("❌ Error guardando pedido completo:", error);
}

/* HISTORIAL */
async function guardarHistorial(telefono, mensaje, tipo = "cliente") {
  const { error } = await supabase.from("historial").insert({
    telefono,
    mensaje,
    tipo,
    fecha: new Date()
  });

  if (error) console.error("❌ Error guardando historial:", error);
}

module.exports = {
  guardarPedidoTemporal,
  guardarClienteNuevo,
  guardarPedidoCompleto,
  guardarHistorial
};
