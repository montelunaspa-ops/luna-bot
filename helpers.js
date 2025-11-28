import rules from "./rules.js";
import catalogo from "./catalogo.js";

export function validarComuna(t) {
  const c = t.toLowerCase();
  return {
    reparto: rules.comunas.includes(c),
    horario: rules.horarios[c]
  };
}

export function extraerCantidad(texto) {
  const m = texto.match(/\b(\d+)\b/);
  return m ? parseInt(m[1]) : 1;
}

export function detectarProducto(texto) {
  texto = texto.toLowerCase();
  const items = [];

  if (texto.includes("queque")) {
    let sabor = null;
    for (const s of catalogo.queques_peruanos.sabores) {
      if (texto.includes(s.toLowerCase())) sabor = s;
    }

    items.push({
      nombre: sabor ? `Queque ${sabor}` : "Queque Peruano",
      precio: catalogo.queques_peruanos.precio,
      cantidad: extraerCantidad(texto)
    });
  }

  for (const s of catalogo.bandejas.sabores) {
    if (texto.includes(s.toLowerCase())) {
      items.push({
        nombre: `${s} (20u)`,
        precio: catalogo.bandejas.precio,
        cantidad: extraerCantidad(texto)
      });
    }
  }

  if (texto.includes("chips")) {
    items.push({
      nombre: "Muffin Chips (6u)",
      precio: catalogo.muffins.chips,
      cantidad: extraerCantidad(texto)
    });
  }

  if (texto.includes("premium") || texto.includes("surtido")) {
    items.push({
      nombre: "Muffins Premium (6u)",
      precio: catalogo.muffins.premium,
      cantidad: extraerCantidad(texto)
    });
  }

  return items;
}

export function calcularResumen(carrito) {
  const total = carrito.reduce((sum, p) => sum + p.precio * p.cantidad, 0);
  const envio = total >= rules.despacho_gratis ? 0 : rules.costo_envio;

  return { total, envio };
}
