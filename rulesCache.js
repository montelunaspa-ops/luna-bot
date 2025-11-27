let cache = null;
let lastLoad = 0;

export function guardarReglas(texto) {
  cache = texto;
  lastLoad = Date.now();
}

export function obtenerReglasCache() {
  return cache;
}

export function obtenerMomentoCarga() {
  return lastLoad;
}
