let reglas = null;
let cargado = null;

export function guardarReglas(contenido) {
  reglas = contenido;
  cargado = Date.now();
}

export function obtenerReglasCache() {
  return reglas;
}

export function obtenerMomentoCarga() {
  return cargado;
}
