import rules from "./rules.js";

export function detectarProducto(texto) {
  const productos = [];

  const lista = [
    { nombre: "queque", precio: 8500 },
    { nombre: "queques", precio: 8500 },
    { nombre: "muffin", precio: 3500 },
    { nombre: "muffins", precio: 3500 },
    { nombre: "bandeja", precio: 4000 },
    { nombre: "alfajor", precio: 6000 },
    { nombre: "cachito", precio: 6000 }
  ];

  for (const p of lista) {
    if (texto.includes(p.nombre)) {
      productos.push({
        nombre: p.nombre,
        cantidad: 1,
        precio: p.precio
      });
    }
  }

  return productos;
}

export function calcularResumen(carrito) {
  let total = 0;

  for (const p of carrito) {
    total += p.cantidad * p.precio;
  }

  const envio = total >= rules.despacho_gratis ? 0 : rules.costo_envio;

  return { total, envio };
}

export function decidirSiguientePaso(cliente) {
  if (!cliente.comuna) {
    return "💛 ¿En qué comuna enviamos tu pedido?";
  }

  if (!cliente.carrito || cliente.carrito.length === 0) {
    return "¿Qué deseas pedir? 💛";
  }

  return "¿Deseas ver el resumen de tu pedido? 💛";
}
