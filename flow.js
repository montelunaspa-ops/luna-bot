export function obtenerContextoFlujo(historial, listaComunas) {
  const contexto = {
    tieneComuna: false,
  };

  const ultimo = normalizar(
    historial[historial.length - 1]?.mensaje_usuario || ""
  );

  if (listaComunas.some(c => ultimo.includes(c))) contexto.tieneComuna = true;

  return contexto;
}
