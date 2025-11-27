export function generarPrompt(historial, mensaje, cliente, reglas, memoria) {
  let hist = "";

  historial?.forEach(h => {
    hist += `Cliente: ${h.mensaje_cliente}\nLuna: ${h.respuesta_luna}\n`;
  });

  return `
REGLAS DEL NEGOCIO:
${reglas}

MEMORIA DEL PEDIDO (NO LO MENCIONES AL CLIENTE):
${JSON.stringify(memoria)}

DATOS DEL CLIENTE:
- Nombre: ${cliente.nombre || "Pendiente"}
- Dirección: ${cliente.direccion || "Pendiente"}
- Comuna: ${cliente.comuna || "Pendiente"}
- Extra: ${cliente.telefono_adicional || "Pendiente"}

HISTORIAL:
${hist}

MENSAJE ACTUAL:
${mensaje}

INSTRUCCIONES:
- Responde como Luna.
- Habla natural, amable y con intención de cerrar venta.
- Guía paso a paso.
- Solo pide datos del cliente al final.
- Si el cliente dice cualquier frase de confirmación, activa confirmación final.
`;
}
