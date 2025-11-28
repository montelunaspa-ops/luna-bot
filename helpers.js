// helpers.js — Versión B (restaurada)
import rules from "./rules.js";

// VALIDAR COMUNA
export function validarComuna(texto) {
  const comuna_text = texto.toLowerCase().trim();
  const comunas_validas = rules.comunas;

  if (comunas_validas.includes(comuna_text)) {
    return {
      reparto: true,
      comuna: comuna_text,
      horario: rules.horarios[comuna_text]
    };
  }

  return { reparto: false };
}

// DETECTAR PRODUCTOS
export function detectarProducto(texto) {
  texto = texto.toLowerCase();
  const productos = [];

  function add(nombre, precio) {
    productos.push({ nombre, precio, cantidad: 1 });
  }

  if (texto.includes("queque peruano") || texto.includes("queque")) {
    add("Queque Peruano", 8500);
  }

  if (texto.includes("bandeja")) {
    add("Bandeja de 20 unidades", 4000);
  }

  if (texto.includes("muffin chips")) {
    add("Muffin Chips (6u)", 3500);
  }

  if (texto.includes("muffin premium") || texto.includes("premium")) {
    add("Muffins Premium (6u)", 5000);
  }

  if (texto.includes("alfajor")) {
    add("Alfajores Premium (12u)", 6000);
  }

  if (texto.includes("cachitos")) {
    add("Cachitos Manjar Premium (10u)", 6000);
  }

  if (texto.includes("rectangular")) {
    add("Queque Artesanal Rectangular", 3000);
  }

  return productos;
}

// CALCULAR RESUMEN
export function calcularResumen(carrito) {
  let total = 0;

  carrito.forEach((p) => {
    total += p.cantidad * p.precio;
  });

  const envio = total >= rules.despacho_gratis ? 0 : rules.costo_envio;

  return { total, envio };
}
