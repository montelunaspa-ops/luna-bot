export function generarPrompt(historial, mensaje, cliente) {
  let historialTexto = historial
    .map(
      h => `Cliente: ${h.mensaje_cliente}\nLuna: ${h.respuesta_luna}`
    )
    .join("\n");

  return `
Historial del cliente:
${historialTexto || "Sin historial previo."}

Datos del cliente:
Nombre: ${cliente?.nombre || "N/A"}
Comuna: ${cliente?.comuna || "N/A"}
Dirección: ${cliente?.direccion || "N/A"}
Punto de referencia: ${cliente?.punto_referencia || "N/A"}
Tipo de vivienda: ${cliente?.tipo_vivienda || "N/A"}
Método de pago: ${cliente?.metodo_pago || "N/A"}

Mensaje actual del cliente:
${mensaje}

Responde de forma amable, natural y orientada a ventas, guiando el pedido.`;
}
