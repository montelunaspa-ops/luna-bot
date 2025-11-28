export function obtenerContextoFlujo(historial) {
  const contexto = {
    tieneComuna: false,
    tieneProducto: false,
    tieneCantidad: false,
    tieneFecha: false,
    tieneDireccion: false,
    tieneNombre: false
  };

  const ult = historial[historial.length - 1]?.mensaje_usuario?.toLowerCase() || "";

  if (ult.includes("santiago") || ult.includes("maipu") || ult.includes("conchali")) contexto.tieneComuna = true;
  if (ult.includes("queque") || ult.includes("muffin") || ult.includes("galleta") || ult.includes("alfajor")) contexto.tieneProducto = true;
  if (ult.match(/\b\d+\b/)) contexto.tieneCantidad = true;
  if (ult.includes("calle") || ult.includes("av") || ult.includes("direccion")) contexto.tieneDireccion = true;
  if (ult.split(" ").length >= 2 && ult.match(/[a-z]/)) contexto.tieneNombre = true;

  return contexto;
}
