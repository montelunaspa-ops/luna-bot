export function generarPrompt(historial, mensaje, cliente) {
  let historialStr = historial.map(h => `Cliente: ${h.mensaje_cliente}\nLuna: ${h.respuesta_luna}`).join("\n");
  return `
Historial del cliente:
${historialStr || "No hay historial"}

Datos del cliente:
Nombre: ${cliente.nombre}
Comuna: ${cliente.comuna}
Dirección: ${cliente.direccion}
Punto de referencia: ${cliente.punto_referencia}
Tipo de vivienda: ${cliente.tipo_vivienda}
Método de pago: ${cliente.metodo_pago}

Mensaje actual:
${mensaje}
`;
}
