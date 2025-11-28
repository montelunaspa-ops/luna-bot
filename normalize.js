export function normalizar(texto) {
  return texto
    ?.toString()
    ?.normalize("NFD")
    ?.replace(/[\u0300-\u036f]/g, "")
    ?.trim()
    ?.toLowerCase();
}
