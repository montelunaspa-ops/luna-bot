import { createRequire } from "module";
const require = createRequire(import.meta.url);

const rules = require("./rules.json");
const catalogo = require("./catalogo.json");

export function esNombre(t) {
  return t.split(" ").length >= 2;
}

export function esDireccion(t) {
  return /\d/.test(t);
}

export function esTelefono(t) {
  return /^[0-9+\s-]{7,15}$/.test(t);
}

export function validarComuna(texto) {
  const t = texto.toLowerCase();
  const comunas = rules.comunas_con_reparto.map((c) => c.toLowerCase());

  return {
    reparto: comunas.includes(t),
    horario: rules.horarios_entrega[t],
    domicilio: rules.retiro_domicilio
  };
}

export function extraerCantidad(texto) {
  const m = texto.match(/\b(\d+)\b/);
  return m ? parseInt(m[1]) : 1;
}

export function detectarProducto(texto) {
  texto = texto.toLowerCase();
  const items = [];

  // Queques peruanos
  if (texto.includes("queque")) {
    const cantidad = extraerCantidad(texto);
    let sabor = null;

    for (const s of catalogo.queques_peruanos.sabores) {
      if (texto.includes(s.toLowerCase())) sabor = s;
    }

    items.push({
      nombre: sabor ? `Queque ${sabor}` : "Queque Peruano",
      precio: catalogo.queques_peruanos.precio,
      cantidad
    });
  }

  // Bandejas 20 unidades
  for (const s of catalogo.galletas_bandeja_20.sabores) {
    if (texto.includes(s.toLowerCase())) {
      items.push({
        nombre: `${s} (bandeja 20u)`,
        precio: catalogo.galletas_bandeja_20.precio,
        cantidad: extraerCantidad(texto)
      });
    }
  }

  // Muffins
  if (texto.includes("chips")) {
    items.push({
      nombre: "Muffin Chips (6u)",
      precio: catalogo.muffins.chips.precio,
      cantidad: extraerCantidad(texto)
    });
  }

  if (texto.includes("premium") || texto.includes("surtido")) {
    items.push({
      nombre: "Muffins Premium (6u)",
      precio: catalogo.muffins.premium_surtido.precio,
      cantidad: extraerCantidad(texto)
    });
  }

  // Delicias premium
  if (texto.includes("alfajor")) {
    items.push({
      nombre: "Alfajor Premium (12u)",
      precio: catalogo.delicias_premium.alfajor_maicena.precio,
      cantidad: extraerCantidad(texto)
    });
  }

  if (texto.includes("cachito")) {
    items.push({
      nombre: "Cachitos Manjar Premium (10u)",
      precio: catalogo.delicias_premium.cachitos_manjar.precio,
      cantidad: extraerCantidad(texto)
    });
  }

  // Queque rectangular
  if (texto.includes("rectangular")) {
    let sabor = null;

    for (const s of catalogo.queque_rectangular.sabores) {
      if (texto.includes(s.toLowerCase())) sabor = s;
    }

    items.push({
      nombre: sabor
        ? `Queque Rectangular ${sabor}`
        : "Queque Rectangular",
      precio: catalogo.queque_rectangular.precio_unidad,
      cantidad: extraerCantidad(texto)
    });
  }

  return items;
}

export function calcularResumen(carrito) {
  let total = carrito.reduce((a, p) => a + p.precio * p.cantidad, 0);
  const envio =
    total >= rules.despacho_gratis_desde ? 0 : rules.costo_despacho;

  return { total, envio };
}
