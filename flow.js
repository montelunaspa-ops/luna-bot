export function obtenerContextoFlujo(historial) {
  const contexto = {
    tieneComuna: false,
    tieneProducto: false,
    tieneCantidad: false,
    tieneFecha: false,
  };

  const texto = historial
    .map(h => h.mensaje_usuario + " " + h.respuesta_bot)
    .join(" ")
    .toLowerCase();

  if (texto.includes("comuna")) contexto.tieneComuna = true;
  if (texto.includes("queque") || texto.includes("alfajor") || texto.includes("muffin")) contexto.tieneProducto = true;
  if (texto.includes("unidad") || texto.includes("unidades")) contexto.tieneCantidad = true;
  if (texto.includes("entrega") || texto.includes("mañana")) contexto.tieneFecha = true;

  return contexto;
}
