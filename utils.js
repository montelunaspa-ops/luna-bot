const rules = require("./rules");

/* ======================================================
   NORMALIZAR TEXTO (elimina tildes, acentos y mayúsculas)
====================================================== */
function normalizar(texto = "") {
  return texto
    .toLowerCase()
    .normalize("NFD") // separar letras y acentos
    .replace(/[\u0300-\u036f]/g, "") // eliminar acentos
    .trim();
}

/* ======================================================
   LISTA DE COMUNAS VALIDAS NORMALIZADAS
====================================================== */
const comunasValidas = Object.keys(rules.horarios).map(c => normalizar(c));

/* ======================================================
   DISTANCIA DE LEVENSHTEIN (medir similitud entre palabras)
====================================================== */
function levenshtein(a, b) {
  const matrix = [];

  let i, j;

  if (!a.length) return b.length;
  if (!b.length) return a.length;

  for (i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (i = 1; i <= b.length; i++) {
    for (j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/* ======================================================
   SIMILITUD ENTRE DOS PALABRAS (0 a 1)
====================================================== */
function similitud(a, b) {
  const distancia = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - distancia / maxLen;
}

/* ======================================================
   DETECTAR COMUNA CON CORRECCIÓN AUTOMÁTICA
====================================================== */
function comunaValida(input = "") {
  if (!input) return null;

  // Normalizamos
  const comunaNormalizada = normalizar(input);

  // Caso 1: Coincidencia exacta
  if (comunasValidas.includes(comunaNormalizada)) {
    return Object.keys(rules.horarios).find(
      c => normalizar(c) === comunaNormalizada
    );
  }

  // Caso 2: Intentamos corregir con similitud
  let mejorCoincidencia = null;
  let mejorSimilitud = 0;

  for (const comuna of comunasValidas) {
    const s = similitud(comunaNormalizada, comuna);

    if (s > mejorSimilitud) {
      mejorSimilitud = s;
      mejorCoincidencia = comuna;
    }
  }

  // Umbral mínimo de similitud (ajustable)
  if (mejorSimilitud >= 0.6) {
    return Object.keys(rules.horarios).find(
      c => normalizar(c) === mejorCoincidencia
    );
  }

  return null;
}

/* ======================================================
   EXPORTAR
====================================================== */
module.exports = {
  normalizar,
  comunaValida,
  similitud,
  levenshtein
};
