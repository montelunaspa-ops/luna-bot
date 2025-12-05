// Comunas con cobertura de despacho
const comunasCobertura = [
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
];

const horarios = {
  "Cerro Navia": "11:00–13:00 hrs",
  "Cerrillos": "11:00–13:00 hrs",
  "Conchalí": "12:00–14:00 hrs",
  "Estación Central": "09:00–11:00 hrs",
  "Independencia": "11:00–14:00 hrs",
  "Lo Prado": "11:00–13:00 hrs",
  "Lo Espejo": "10:00–12:00 hrs",
  "Maipú": "10:00–12:00 hrs",
  "Pedro Aguirre Cerda": "10:00–12:00 hrs",
  "Pudahuel": "12:00–14:00 hrs",
  "Quinta Normal": "10:00–13:00 hrs",
  "Recoleta": "11:00–13:00 hrs",
  "Renca": "10:00–13:00 hrs",
  "Santiago Centro": "09:00–11:00 hrs",
  "San Miguel": "10:00–12:00 hrs",
  "San Joaquín": "10:00–12:00 hrs"
};

const comunasTexto =
"📍 *COMUNAS CON DESPACHO*\n\n" +
"• Cerro Navia\n" +
"• Cerrillos\n" +
"• Conchalí\n" +
"• Estación Central\n" +
"• Independencia\n" +
"• Lo Prado\n" +
"• Lo Espejo (zona cercana a Pedro Aguirre Cerda y antes de Vespucio)\n" +
"• Maipú (antes de Av. Vespucio entre Estación Central y Cerrillos)\n" +
"• Pedro Aguirre Cerda\n" +
"• Pudahuel (Norte y Sur)\n" +
"• Quinta Normal\n" +
"• Recoleta\n" +
"• Renca\n" +
"• Santiago Centro\n" +
"• San Miguel\n" +
"• San Joaquín\n";

module.exports = {
  bienvenida:
"¡Hola! Soy Luna, tu asistente virtual de *Delicias Monte Luna* 🌙✨\n" +
"Estoy aquí para ayudarte con tu pedido 😊",

  catalogo:
"📦 *CATÁLOGO DELICIAS MONTE LUNA*\n\n" +
"🍰 *QUEQUES PERUANOS* — $8.500\n" +
"_Sabores:_ Chocolate, Marmoleado, Piña, Vainilla, Naranja, Maracuyá\n" +
"_Porciones:_ 14, 16 o sin cortar\n" +
"_Tamaño:_ 28 cm x 10 cm\n\n" +
"🍪 *GALLETAS Y DELICIAS* — Bandejas de 20 unidades — $4.000\n" +
"_Variedades:_ Rellena de Manjar, Alemana, Giro Coco, Almejitas, Lengua de Gato,\n" +
"Cocadas de Horno, Alfajorcito, Cachitos\n\n" +
"🧁 *MUFFINS*\n" +
"• Chips (6 unidades): $3.500\n" +
"• Premium surtido (6 unidades): $5.000\n" +
"_Sabores surtidos:_ Chocolate, Red Velvet, Arándano, Coco y Chips\n\n" +
"🤩 *DELICIAS PREMIUM*\n" +
"• Alfajores de Maicena Premium (12 unidades, 8–9 cm): $6.000\n" +
"• Cachitos Manjar Premium (10 unidades, 11–12 cm): $6.000\n\n" +
"🍞 *QUEQUE ARTESANAL RECTANGULAR* — 20 cm\n" +
"_Sabores:_ Vainilla Chips, Manzana, Arándanos\n" +
"_Precio:_ $3.000\n" +
"_Oferta:_ 4 unidades por $10.000 (sabores a elección)\n\n" +
"Las entregas se realizan *al día siguiente*, excepto domingos.\n",

  comunasCobertura,
  comunasTexto,
  horarios,

  politicas:
"📌 *Información importante*\n\n" +
"• Domingos no se hacen despachos; los pedidos de sábado y domingo se entregan el lunes.\n" +
"• Estamos ubicados en *Calle Chacabuco 1120, Santiago Centro*.\n" +
"• Entregas por ruta con varios pedidos (la hora exacta no se garantiza).\n" +
"• Métodos de pago: *efectivo o débito*.\n" +
"• Retiros en domicilio (previa coordinación):\n" +
"  - Lunes a Viernes: 10:00–11:00 y 18:00–20:00\n" +
"  - Sábado: 10:00–12:00\n"
};
