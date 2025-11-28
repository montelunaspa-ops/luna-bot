// ===============================================
//  Normaliza textos para hacer IA más robusta
// ===============================================

export function normalizar(texto) {
  return texto
    ?.toString()
    ?.normalize("NFD")
    ?.replace(/[\u0300-\u036f]/g, "")
    ?.replace(/\s+/g, " ")
    ?.trim()
    ?.toLowerCase();
}
