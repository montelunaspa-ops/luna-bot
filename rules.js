// rules.js — Archivo maestro de reglas e información oficial

export default {
  asistente: "Luna, asistente virtual de Delicias Monte Luna",

  mensaje_bienvenida:
    "¡Hola! Soy Luna, asistente virtual de Delicias Monte Luna 🌙✨. Te ayudo con tu pedido y con cualquier duda.",

  catalogo_texto: `
🍰 *Queques Peruanos — $8.500*
Sabores: Chocolate, Marmoleado, Piña, Vainilla, Naranja, Maracuyá
Porciones: 14, 16 o sin cortar
Tamaño: 28 cm de diámetro, 10 cm alto aprox.

🍪 *Bandejas de 20 unidades — $4.000*
Rellena de Manjar, Alemana, Giro Coco, Almejitas, Lengua de Gato,
Cocadas de Horno, Alfajorcito, Cachitos
(No son surtidas)

🧁 *Muffins*
• Chips (6 unidades): $3.500
• Surtidos Premium (6 unidades): $5.000
  (1 Chocolate, 1 Red Velvet, 1 Arándano, 1 Coco, 2 Chips)

🤩 *Delicias Premium*
• Alfajores Premium (12 unidades, 8-9cm): $6.000
• Cachitos Manjar Premium (10 unidades, 11-12cm): $6.000

📦 *Queque Artesanal Rectangular — $3.000*
Sabores: Vainilla Chips, Manzana, Arándanos
Oferta: 4 por $10.000

💛 Entregas al día siguiente, excepto domingos.
`,

  comunas_reparto: [
    "cerro navia",
    "cerrillos",
    "conchalí",
    "estación central",
    "independencia",
    "lo prado",
    "lo espejo",
    "maipú",
    "pedro aguirre cerda",
    "pudahuel",
    "quinta normal",
    "recoleta",
    "renca",
    "santiago centro",
    "san miguel",
    "san joaquín"
  ],

  horarios_entrega: {
    "cerro navia": "11-13 hrs",
    "cerrillos": "11-13 hrs",
    "conchalí": "12-14 hrs",
    "estación central": "9-11 hrs",
    "independencia": "11-14 hrs",
    "lo prado": "11-13 hrs",
    "lo espejo": "10-12 hrs",
    "maipú": "10-12 hrs",
    "pedro aguirre cerda": "10-12 hrs",
    "pudahuel": "12-14 hrs",
    "quinta normal": "10-13 hrs",
    "recoleta": "11-13 hrs",
    "renca": "10-13 hrs",
    "santiago centro": "9-11 hrs",
    "san miguel": "10-12 hrs",
    "san joaquín": "10-12 hrs"
  },

  reglas_envio: {
    despacho_gratis: 14990,
    costo_envio: 2400,
    domicilio_retiro: "Calle Chacabuco 1120, Santiago Centro",
    entrega_presencial:
      "Lunes a viernes 10am-11am y 6pm-8pm; sábados 10am-12pm (agendar previamente)",
    pago: ["efectivo", "débito"],
    domingos: "No se hacen despachos; pedidos sábado y domingo se entregan lunes"
  }
};
