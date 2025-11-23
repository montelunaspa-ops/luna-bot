export function generarPrompt(historial = [], mensaje, cliente) {
  let historialText = historial.map(h => `Cliente: ${h.mensaje_cliente}\nLuna: ${h.respuesta_luna}`).join("\n");
  return `Historial:\n${historialText}\n\nCliente actual: ${mensaje}\nInformación cliente: ${JSON.stringify(cliente)}`;
}
