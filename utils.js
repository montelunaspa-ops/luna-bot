function normalizar(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function detectarCantidad(texto) {
  const m = texto.match(/(\d+)\s*(unidades|u|unidad|porciones|p|x)?/i);
  return m ? parseInt(m[1]) : 1;
}

function detectarSabores(texto) {
  const lista = [
    "chocolate",
    "piña",
    "marmoleado",
    "vainilla",
    "naranja",
    "maracuyá",
    "arándanos",
    "chips",
    "manzana"
  ];
  const low = normalizar(texto);
  return lista.filter((s) => low.includes(normalizar(s)));
}

function comunaValida(texto) {
  const t = normalizar(texto);
  const mapa = {
    maipu: "Maipú",
    pudahuel: "Pudahuel",
    cerro_navja: "Cerro Navia",
    conchali: "Conchalí",
    estacion_central: "Estación Central"
  };

  for (const k in mapa) {
    if (t.includes(normalizar(mapa[k]))) return mapa[k];
  }

  return null;
}

module.exports = {
  normalizar,
  detectarCantidad,
  detectarSabores,
  comunaValida
};
