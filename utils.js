const rules = require("./rules");

function normalizar(str = "") {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Detecta si el texto contiene alguna comuna de cobertura.
 * No lista todas las comunas de Chile, solo las de rules.comunasCobertura.
 */
function comunaValida(texto) {
  const t = normalizar(texto);
  if (!t) return null;

  for (const comuna of rules.comunasCobertura) {
    const nc = normalizar(comuna);
    if (t.includes(nc)) {
      return comuna;
    }
  }

  // Correcciones típicas
  if (t.includes("maipu")) return "Maipú";
  if (t.includes("pudahuel")) return "Pudahuel";
  if (t.includes("estacion central") || t.includes("estacioncentral"))
    return "Estación Central";
  if (t.includes("santiago")) return "Santiago Centro";

  return null;
}

module.exports = {
  normalizar,
  comunaValida
};
