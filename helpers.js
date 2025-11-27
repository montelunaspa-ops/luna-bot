// helpers.js
import { RULES } from "./rules.js";
import { CATALOGO } from "./catalogo.js";

export function normalizarTexto(t = "") {
  return t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function esNombre(t = "") {
  return t.trim().split(" ").length >= 2 && t.length <= 60;
}

export function esDireccion(t = "") {
  return /\d/.test(t) && t.length >= 5;
}

export function esTelefono(t = "") {
  return /^[0-9+\s-]{7,15}$/.test(t.trim());
}

export function validarComuna(texto = "") {
  const t = normalizarTexto(texto);
  const lista = RULES.comunasDespacho;
  const reparto = lista.includes(t);
  const horario = RULES.horariosEntrega[t] || null;

  return {
    reparto,
    horario,
    domicilio: RULES.retiroDomicilio
  };
}

export function extraerCantidad(texto = "") {
  const match = texto.match(/\b(\d+)\b/);
  return match ? parseInt(match[1], 10) : 1;
}

/**
 * Detecta productos mencionados en el texto (muy simple, basado en palabras clave)
 * Devuelve una lista de items: { nombre, categoria, precio, cantidad }
 */
export function detectarProductos(texto = "") {
  const t = normalizarTexto(texto);
  const items = [];

  // Queques peruanos
  if (t.includes("queque") || t.includes("queques")) {
    const cant = extraerCantidad(t);
    let sabor = null;
    for (const s of CATALOGO.quequesPeruanos.sabores) {
      if (t.includes(normalizarTexto(s))) sabor = s;
    }
    items.push({
      categoria: "Queques Peruanos",
      nombre: sabor ? `Queque Peruano de ${sabor}` : "Queque Peruano",
      precio: CATALOGO.quequesPeruanos.precio,
      cantidad: cant
    });
  }

  // Galletas en bandeja
  for (const g of CATALOGO.galletasBandeja.productos) {
    if (t.includes(normalizarTexto(g))) {
      const cant = extraerCantidad(t);
      items.push({
        categoria: "Galletas Bandeja 20",
        nombre: `Bandeja ${g} (20 unidades)`,
        precio: CATALOGO.galletasBandeja.precio,
        cantidad: cant
      });
    }
  }

  // Muffins
  if (t.includes("muffin chips") || t.includes("muffins chips")) {
    const cant = extraerCantidad(t);
    items.push({
      categoria: "Muffins",
      nombre: CATALOGO.muffins.chips.nombre,
      precio: CATALOGO.muffins.chips.precio,
      cantidad: cant
    });
  }

  if (t.includes("muffin premium") || t.includes("muffins premium") || t.includes("muffins surtidos")) {
    const cant = extraerCantidad(t);
    items.push({
      categoria: "Muffins",
      nombre: CATALOGO.muffins.premium.nombre,
      precio: CATALOGO.muffins.premium.precio,
      cantidad: cant
    });
  }

  // Delicias premium
  if (t.includes("alfajor") && t.includes("maicena")) {
    const cant = extraerCantidad(t);
    items.push({
      categoria: "Delicias Premium",
      nombre: CATALOGO.deliciasPremium.alfajoresMaicena.nombre,
      precio: CATALOGO.deliciasPremium.alfajoresMaicena.precio,
      cantidad: cant
    });
  }

  if (t.includes("cachito")) {
    const cant = extraerCantidad(t);
    items.push({
      categoria: "Delicias Premium",
      nombre: CATALOGO.deliciasPremium.cachitosManjar.nombre,
      precio: CATALOGO.deliciasPremium.cachitosManjar.precio,
      cantidad: cant
    });
  }

  // Queque rectangular
  if (t.includes("rectangular")) {
    const cant = extraerCantidad(t);
    let sabor = null;
    for (const s of CATALOGO.quequeRectangular.sabores) {
      if (t.includes(normalizarTexto(s))) sabor = s;
    }
    items.push({
      categoria: "Queque Rectangular",
      nombre: sabor
        ? `Queque Rectangular de ${sabor}`
        : "Queque Rectangular",
      precio: CATALOGO.quequeRectangular.precioUnidad,
      cantidad: cant
    });
  }

  return items;
}

/**
 * Calcula total y envío a partir del pedido (array de items)
 */
export function calcularResumen(pedidoItems = []) {
  let total = 0;
  for (const p of pedidoItems) {
    total += p.precio * p.cantidad;
  }

  const envio = total >= RULES.despachoGratisDesde ? 0 : RULES.costoDespacho;

  return { total, envio };
}

/**
 * Construye un texto de resumen legible para el cliente
 */
export function construirTextoResumen(pedidoItems, comuna) {
  const { total, envio } = calcularResumen(pedidoItems);
  const comunaNorm = normalizarTexto(comuna || "");
  const horario = RULES.horariosEntrega[comunaNorm] || "horario de ruta durante el día";

  const detalle = pedidoItems
    .map(
      (p) =>
        `- ${p.cantidad} x ${p.nombre} ($${p.precio} c/u)`
    )
    .join("\n");

  const totalLinea = `Total productos: $${total}`;
  const envioLinea =
    envio === 0
      ? "Envío: GRATIS (por compras sobre $14.990)"
      : `Envío: $${envio}`;

  const entregaLinea =
    "Entrega: al día siguiente (excepto domingos). Horario aproximado para tu comuna: " +
    horario +
    ".";

  return {
    texto:
      `Resumen de tu pedido 💛\n\n` +
      `${detalle}\n\n` +
      `${totalLinea}\n${envioLinea}\n${entregaLinea}\n\n` +
      `Si todo está correcto, por favor escribe *CONFIRMO* para agendar tu pedido.`,
    total,
    envio
  };
}
