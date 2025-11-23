/**
 * Genera el prompt principal que se enviará a GPT
 * @param {Array} historial - mensajes previos del cliente
 * @param {string} mensaje - mensaje actual del cliente
 * @param {Object} cliente - datos del cliente
 * @returns {string}
 */
export function generarPrompt(historial, mensaje, cliente) {
  let historialText = historial
    .map(
      (h) =>
        `Cliente: ${h.mensaje_cliente}\nLuna: ${h.respuesta_luna}`
    )
    .join("\n");

  return `
Historial del cliente:
${historialText || "Sin historial"}

Datos del cliente:
Nombre: ${cliente.nombre || "Desconocido"}
Comuna: ${cliente.comuna || "Desconocida"}
Dirección: ${cliente.direccion || "Desconocida"}
Punto de referencia: ${cliente.punto_referencia || "No especificado"}
Tipo de vivienda: ${cliente.tipo_vivienda || "No especificado"}
Método de pago: ${cliente.metodo_pago || "No especificado"}

Mensaje actual del cliente:
${mensaje}

Responde de manera amable, natural y orientada a ventas, guiando al cliente con opciones claras.
`;
}
