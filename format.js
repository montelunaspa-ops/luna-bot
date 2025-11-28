export function limpiarMensaje(texto) {
  if (!texto) return "";
  return texto.trim().toLowerCase();
}
