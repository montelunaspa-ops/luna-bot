export function generarPrompt(historial, mensajeCliente, cliente, reglas) {
  let historialTxt = "";

  if (historial) {
    historial.forEach(h => {
      historialTxt += `Cliente: ${h.mensaje_cliente}\nLuna: ${h.respuesta_luna}\n`;
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
${historialTxt}

MENSAJE ACTUAL:
${mensajeCliente}

RESPONDE COMO LUNA: natural, amable, con enfoque en ventas, clara y precisa.
`;
}
