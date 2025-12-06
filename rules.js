const rules = {
  bienvenida:
    "¡Hola! Soy Luna, asistente virtual de *Delicias Monte Luna* 🌙✨\nEstoy aquí para ayudarte con tu pedido 😊",

  catalogo: `
📦 *CATÁLOGO DELICIAS MONTE LUNA*

🍰 *QUEQUES PERUANOS* — $8.500  
Sabores disponibles: Chocolate, Marmoleado, Piña, Vainilla, Naranja, Maracuyá  
Porciones: 14, 16 o sin cortar  
Tamaño: 28 cm de diámetro, 10 cm de alto aprox.  

🍪 *GALLETAS Y DELICIAS* — Bandejas de 20 unidades — $4.000  
Variedades: Rellena de Manjar, Alemana, Giro Coco, Almejitas, Lengua de Gato,  
Cocadas de Horno, Alfajorcito, Cachitos  

🧁 *MUFFINS*  
• Muffin Chips (6 unidades, empaque individual): $3.500  
• Muffins Premium Sabores Surtidos (6 unidades: 1 Chocolate, 1 Red Velvet, 1 Arándano, 1 Coco, 2 Chips): $5.000  

🤩 *DELICIAS PREMIUM*  
• Alfajores Premium de Maicena (12 unidades, 8–9 cm): $6.000  
• Cachitos Manjar Premium (10 unidades, 11–12 cm): $6.000  

📦 *QUEQUE ARTESANAL RECTANGULAR*  
• Sabores: Vainilla Chips, Manzana, Arándanos  
• Tamaño: 20 cm  
• Precio: $3.000 c/u  
• Oferta: 4 unidades por $10.000 (sabores a elección)  
`,

  comunasCobertura: [
    "Cerro Navia",
    "Cerrillos",
    "Conchalí",
    "Estación Central",
    "Independencia",
    "Lo Prado",
    "Lo Espejo",
    "Maipú",
    "Pedro Aguirre Cerda",
    "Pudahuel",
    "Quinta Normal",
    "Recoleta",
    "Renca",
    "Santiago Centro",
    "San Miguel",
    "San Joaquín"
  ],

  comunasTexto: `
📍 *COMUNAS CON DESPACHO*
• Cerro Navia  
• Cerrillos  
• Conchalí  
• Estación Central  
• Independencia  
• Lo Prado  
• Lo Espejo (zona cercana a Pedro Aguirre Cerda y antes de Vespucio)  
• Maipú (antes de Av. Vespucio entre Estación Central y Cerrillos)  
• Pedro Aguirre Cerda  
• Pudahuel (Norte y Sur)  
• Quinta Normal  
• Recoleta  
• Renca  
• Santiago Centro  
• San Miguel  
• San Joaquín  
`,

  horarios: {
    "Cerro Navia": "11:00–13:00",
    "Cerrillos": "11:00–13:00",
    "Conchalí": "12:00–14:00",
    "Estación Central": "09:00–11:00",
    "Independencia": "11:00–14:00",
    "Lo Prado": "11:00–13:00",
    "Lo Espejo": "10:00–12:00",
    "Maipú": "10:00–12:00",
    "Pedro Aguirre Cerda": "10:00–12:00",
    "Pudahuel": "12:00–14:00",
    "Quinta Normal": "10:00–13:00",
    "Recoleta": "11:00–13:00",
    "Renca": "10:00–13:00",
    "Santiago Centro": "09:00–11:00",
    "San Miguel": "10:00–12:00",
    "San Joaquín": "10:00–12:00"
  },

  baseConocimiento: `
Delicias Monte Luna es un emprendimiento de pastelería artesanal.

• Domingos NO se hacen despachos; pedidos de sábado y domingo se despachan el lunes.  
• Estamos ubicados en Calle Chacabuco 1120, Santiago Centro.  
• Las entregas se realizan al día siguiente del pedido (excepto domingo).  
• Despacho GRATIS por compras sobre $14.990.  
• Si la compra es menor, el despacho cuesta $2.400.  
• Entregas por ruta con varios pedidos, la hora exacta NO se puede garantizar, solo rangos de horario.  
• Métodos de pago: efectivo o débito.  
• Entregas presenciales en domicilio (retiro):  
  - Lunes a viernes: 10:00–11:00 y 18:00–20:00  
  - Sábado: 10:00–12:00  
  - Siempre con agendamiento previo.  
`,

  productosLista: `
Queques Peruanos, Galletas y Delicias en bandeja, Muffins, Delicias Premium (alfajores, cachitos) y Queques Artesanales Rectangulares.
`,

  saboresDisponibles: [
    "Chocolate",
    "Marmoleado",
    "Piña",
    "Vainilla",
    "Naranja",
    "Maracuyá",
    "Arándanos",
    "Manzana",
    "Coco",
    "Red Velvet",
    "Chips"
  ]
};

module.exports = rules;
