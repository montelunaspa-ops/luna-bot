export default {

  asistente: "Luna 💛 asistente virtual de Delicias Monte Luna",

  mensaje_bienvenida: `
¡Hola! Soy Luna, asistente virtual de Delicias Monte Luna 🌙✨
Puedes hacer tu pedido por WhatsApp o en www.monteluna.cl
Aquí tienes nuestro catálogo oficial:
`,

  catalogo: {
    queques_peruanos: {
      nombre: "Queques Peruanos",
      precio: 8500,
      porciones: ["14", "16", "sin cortar"],
      tamaño: "28 cm de diámetro, 10 cm de alto aprox.",
      sabores: [
        "Chocolate",
        "Marmoleado",
        "Piña",
        "Vainilla",
        "Naranja",
        "Maracuyá"
      ]
    },

    bandejas: {
      nombre: "Galletas y Delicias (20 unidades)",
      precio: 4000,
      surtido: false,
      productos: [
        "Rellena de Manjar",
        "Alemana",
        "Giro Coco",
        "Almejitas",
        "Lengua de Gato",
        "Cocadas de Horno",
        "Alfajorcito",
        "Cachitos"
      ]
    },

    muffins: {
      chips: { unidades: 6, precio: 3500 },
      premium: {
        unidades: 6,
        precio: 5000,
        sabores: ["Chocolate", "Red Velvet", "Arándano", "Coco", "Chips"]
      }
    },

    delicias_premium: {
      alfajores: { unidades: 12, tamaño: "8-9 cm", precio: 6000 },
      cachitos: { unidades: 10, tamaño: "11-12 cm", precio: 6000 }
    },

    queque_artesanal: {
      precio: 3000,
      tamaño: "20 cm rectangular",
      sabores: ["Vainilla Chips", "Manzana", "Arándanos"],
      oferta: "4 por $10.000"
    }
  },

  catalogo_texto: `
🍰 *Queques Peruanos — $8.500*
Sabores: Chocolate, Marmoleado, Piña, Vainilla, Naranja, Maracuyá
Porciones: 14, 16 o sin cortar
Tamaño: 28 cm diámetro — 10 cm alto

🍪 *Bandejas de 20 unidades — $4.000*
Manjar, Alemana, Giro coco, Almejitas, Lengua de gato, Cocadas,
Alfajorcito, Cachitos (no surtidas)

🧁 *Muffins*
• Chips (6 unidades): $3.500
• Premium surtidos (6 unidades): $5.000

🤩 *Delicias Premium*
• Alfajores Maicena (12 unidades): $6.000
• Cachitos Manjar Premium (10 unidades): $6.000

📦 *Queque Artesanal Rectangular — $3.000*
Sabores: Vainilla Chips, Manzana, Arándanos
Oferta 4 unidades = $10.000

💛 Entregas al día siguiente (excepto domingo).
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
    domicilio: "Calle Chacabuco 1120, Santiago Centro",
    domicilio_retiro: "Calle Chacabuco 1120, Santiago Centro",
    dias_sin_envio: ["domingo"],
    pago: ["efectivo", "débito"],
    entrega_presencial: "Lunes-Viernes 10-11am y 6-8pm, Sábado 10am-12pm (agendar)"
  },

  instrucciones_flujo: [
    "Pedir comuna antes del pedido.",
    "Validar comuna.",
    "Si no hay reparto → ofrecer retiro.",
    "Luego gestionar pedido: sabores, cantidades, porciones.",
    "Pedir datos: nombre, dirección, teléfono adicional.",
    "Generar resumen del pedido.",
    "Solicitar confirmación.",
    "Guardar pedido y cerrar con ✔️."
  ]

};
