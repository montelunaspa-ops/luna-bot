export function generarPrompt(historial, mensajeCliente, cliente) {
  // Formatear historial
  let historialTexto = "";
  if (historial && historial.length > 0) {
    historial.forEach(h => {
      historialTexto += `Cliente: ${h.mensaje_cliente}\nLuna: ${h.respuesta_luna}\n`;
    });
  }

  // Datos del cliente
  const datosCliente = `
Nombre: ${cliente.nombre || "no proporcionado"}
Dirección: ${cliente.direccion || "no proporcionada"}
Teléfono adicional: ${cliente.telefono_adicional || "no proporcionado"}
  `;

  return `
Historial del cliente:
${historialTexto}

Datos del cliente:
${datosCliente}

Pregunta o mensaje actual del cliente:
${mensajeCliente}

Responde de manera natural, amable, orientada a ventas, guiando el pedido y ofreciendo opciones claras.
`;
}
