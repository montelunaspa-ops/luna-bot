const rules = require("./rules");

/* Detecta si el texto contiene una comuna válida dentro de la cobertura */
function comunaValida(texto) {
  if (!texto) return null;

  const t = texto.toLowerCase();
  return rules.comunasCobertura.find((c) => t.includes(c.toLowerCase())) || null;
}

module.exports = { comunaValida };
