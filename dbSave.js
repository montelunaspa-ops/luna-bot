const supabase = require("./supabase");

async function guardarClienteNuevo(phone, nombre, direccion, telefono2, comuna) {
  const { error } = await supabase.from("clientes_detallados").insert({
    telefono: phone,
    nombre,
    direccion,
    telefono2,
    comuna,
    creado_en: new Date().toISOString()
  });

  if (error) console.log("❌ Error guardando cliente:", error);
}

async function guardarHistorial(phone, mensaje, tipo = "cliente") {
  await supabase.from("historial").insert({
    telefono: phone,
    mensaje,
    tipo,
    fecha: new Date().toISOString()
  });
}

async function guardarPedidoTemporal(phone, pedidoArray) {
  await supabase.from("pedidos").upsert({
    telefono: phone,
    pedido: pedidoArray,
    actualizado_en: new Date().toISOString()
  });
}

async function guardarPedidoCompleto(state) {
  await supabase.from("pedidos_completos").insert({
    telefono: state.phone,
    pedido: state.pedido,
    nombre: state.datos.nombre,
    direccion: state.datos.direccion,
    telefono2: state.datos.telefono2,
    comuna: state.comuna,
    fecha_entrega: state.fechaEntrega,
    horario: state.horarioEntrega,
    creado_en: new Date().toISOString()
  });
}

module.exports = {
  guardarClienteNuevo,
  guardarHistorial,
  guardarPedidoTemporal,
 guardarPedidoCompleto
};
