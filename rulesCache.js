let reglasCache = null;
let ultimaCarga = 0;

export function guardarReglas(texto) {
  reglasCache = texto;
  ultimaCarga = Date.now();
}

export function obtenerReglasCache() {
  return reglasCache;
}

export function obtenerMomentoCarga() {
  return ultimaCarga;
}
