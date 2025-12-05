const rules = require("./rules");

/* Normaliza texto: minúsculas, sin tildes, trim */
function normalizar(texto = "") {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Lista normalizada de comunas con cobertura
const comunasValidasNorm = rules.comunasCobertura.map((c) => normalizar(c));

/* Distancia de Levenshtein */
function levenshtein(a, b) {
  a = a || "";
  b = b || "";
  const matrix = [];

  if (!a.length) return b.length;
  if (!b.length) return a.length;

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
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

function similitud(a, b) {
  const distancia = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - distancia / maxLen;
}

/**
 * Devuelve el nombre CANÓNICO de la comuna dentro de la cobertura
 * o null si no coincide con ninguna.
 */
function comunaValida(input = "") {
  const norm = normalizar(input);
  if (!norm) return null;

  // Coincidencia exacta
  const idxExact = comunasValidasNorm.indexOf(norm);
  if (idxExact !== -1) {
    return rules.comunasCobertura[idxExact];
  }

  // Fuzzy
  let mejorSim = 0;
  let mejorIdx = -1;
  comunasValidasNorm.forEach((c, i) => {
    const s = similitud(norm, c);
    if (s > mejorSim) {
      mejorSim = s;
      mejorIdx = i;
    }
  });

  if (mejorSim >= 0.6 && mejorIdx !== -1) {
    return rules.comunasCobertura[mejorIdx];
  }

  return null;
}

module.exports = {
  normalizar,
  comunaValida,
  similitud,
  levenshtein
};
