export function generarPrompt(historial, mensajeCliente, cliente, reglas) {
  let historialTexto = "";

  if (historial) {
    historial.forEach(h => {
      historialTexto += `Cliente: ${h.mensaje_cliente}\nLuna: ${h.respuesta_luna}\n`;
    });
  }

  return `
REGLAS DEL NEGOCIO:
${reglas}

DATOS DEL CLIENTE:
- Nombre: ${cliente.nombre || "no proporcionado"}
- Dirección: ${cliente.direccion || "no proporcionada"}
- Comuna: ${cliente.comuna || "no proporcionada"}
- Teléfono adicional: ${cliente.telefono_adicional || "no proporcionado"}

HISTORIAL:
${historialTexto}

MENSAJE ACTUAL DEL CLIENTE:
${mensajeCliente}

RESPONDE COMO LUNA, DE FORMA NATURAL, AMABLE, FLUIDA Y CERRANDO VENTAS.
`;
}
