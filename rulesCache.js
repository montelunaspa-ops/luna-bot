// =========================
//     rulesCache.js
// =========================

let contenidoCache = null;
let momentoCarga = null;

export function guardarReglas(contenido) {
  contenidoCache = contenido;
  momentoCarga = Date.now();
}

export function obtenerReglasCache() {
  return contenidoCache;
}

export function obtenerMomentoCarga() {
  return momentoCarga;
}
