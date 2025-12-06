// index.js
// Luna Bot - Delicias Monte Luna
// Bot para WhatsApp (WhatsAuto) usando GPT-4o-mini y Supabase
// Flujo completo de venta controlado por IA, solo texto.

// =======================
// 1. DEPENDENCIAS BÁSICAS
// =======================
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// =======================
// 2. CONFIGURACIONES BASE
// =======================
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para JSON
app.use(bodyParser.json());

// ❗ NECESARIO PARA WHATSauto (application/x-www-form-urlencoded)
app.use(bodyParser.urlencoded({ extended: true }));

// ---------- OpenAI ----------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Supabase ----------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan SUPABASE_URL o SUPABASE_KEY en .env");
}
const supabase = createClient(supabaseUrl, supabaseKey);

// =======================================
// 3. SESIONES EN MEMORIA (POR NÚMERO)
// =======================================
const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      phone,
      knownClient: false,
      checkedClient: false,
      comuna: null,
      cart: [],
      customer: { nombre: null, direccion: null, telefono_alt: null },
      delivery: { fecha_entrega: null, horario_aprox: null },
      state: "inicio",
      orderSaved: false,
      history: [],
    };
  }
  return sessions[phone];
}

function pushHistory(session, role, content) {
  session.history.push({ role, content });
  if (session.history.length > 10) {
    session.history = session.history.slice(-10);
  }
}

// =======================================
// 4. TEXTO DE REGLAS / CATÁLOGO (TAL CUAL)
// =======================================
const RULES_TEXT = `
¡Hola! Soy Luna, asistente virtual de Delicias Monte Luna. 🌙✨
Puedes hacer tu pedido fácilmente por la página www.monteluna.cl o por WhatsApp.

Catálogo:

•	🍰 Queques Peruanos
Sabores disponibles:
o	Chocolate
o	Marmoleado
o	Piña
o	Vainilla
o	Naranja
o	Maracuyá
Porciones: 14, 16 o sin cortar
Tamaño: 28 cm de diámetro, 10 cm de alto aproximadamente
Precio: $8.500

•	🍪 Galletas y Delicias en Bandeja de 20 Unidades
o	Rellena de Manjar
o	Alemana
o	Giro Coco
o	Almejitas 
o	Lengua de Gato
o	Cocadas de Horno
o	Alfajorcito
o	Cachitos
Precio: $4.000 (Bandeja por cada producto, no son surtidas)

•	🧁 Muffins
o	Muffin Chips (6 Unidades, empaque individual): $3.500
o	Muffins Premium Sabores Surtidos (6 Unidades, incluye: 1 Chocolate, 1 Red Velvet, 1 Arándano, 1 Coco, 2 Chips): $5.000

•	🤩 Delicias Premium
o	Alfajores Premium de Maicena (12 Unidades, 8-9 cm): $6.000
o	Cachitos Manjar Premium (10 Unidades, 11-12 cm): $6.000

•	📦 Queque Artesanal Rectangular
o	Sabores: Vainilla Chips, Manzana, Arándanos 
Rectangular de 20 cm
Precio: $3.000
Oferta: 4 Unidades por $10.000 (sabores a tu elección)
Las entregas se realizan al día siguiente de realizar el pedido, excepto los domingos.
¿En qué comuna vamos a despachar?


Comunas de despacho
•	Cerro Navia
•	Cerrillos
•	Conchalí
•	Estación Central
•	Independencia
•	Lo Prado
•	Lo Espejo (si es cerca de pedro Aguirre cerda y antes de Avenida Vespucio)
•	Maipú (si es antes de Avenida Vespucio entre estación central y cerrillos)
•	Pedro Aguirre Cerda
•	Pudahuel (sur y norte)
•	Quinta Normal
•	Recoleta
•	Renca
•	Santiago Centro
•	San Miguel
•	San Joaquín

Horarios aproximados de entrega por comuna
•	Cerro Navia: 11-13 hrs
•	Cerrillos: 11-13 hrs
•	Conchalí: 12-14 hrs
•	Estación Central: 9-11 hrs
•	Independencia: 11-14 hrs
•	Lo Prado: 11-13 hrs
•	Lo Espejo: 10-12 hrs
•	Maipú: 10-12 hrs
•	Pedro Aguirre Cerda: 10-12 hrs
•	Pudahuel: 12-14 hrs
•	Quinta Normal: 10-13 hrs
•	Recoleta: 11-13 hrs
•	Renca: 10-13 hrs
•	Santiago Centro: 9-11 hrs
•	San Miguel: 10-12 hrs
•	San Joaquín: 10-12 hrs



Información adicional y reglas
•	Domingos no se hacen despachos; pedidos recibidos el sábado y domingo se despachan el lunes
•	Estamos ubicados en Calle Chacabuco 1120, Santiago Centro
•	Entregas por ruta con varios pedidos, hora exacta de entrega no garantizada
•	Métodos de pago: efectivo o débito
•	Entregas presenciales en domicilio igualmente al dia siguiente en Calle Chacabuco 1120, Santiago Centro: lunes-viernes 10am a 11am y 6pm a 8pm, sábado 10am a 12pm, agendar previamente
•	Horarios aproximados pueden variar en días festivos o de alto tráfico
`;

// =====================================================
// 5. REGLAS DEL FLUJO (TAL CUAL)
// =====================================================
const FLOW_RULES_TEXT = `
FLUJO OBLIGATORIO DEL BOT (LUNA):

1. En el momento que se reciba cualquier mensaje se da la bienvenida.
2. Se valida el número de WhatsApp en la base de datos clientes:
   - Si está en la base de datos clientes se omite el paso 3 y el paso 5.
   - Si NO está en la base de datos clientes se envía el catálogo y se pregunta para qué comuna será despachado el pedido.
3. Se valida la comuna:
   - Si la comuna está dentro de las comunas con reparto:
     - Informar el horario aproximado de entrega.
     - Informar que NO hay compra mínima.
     - Informar que el despacho es GRATUITO por compras mayores a $14.990.
     - Si la compra es menor, el despacho sale en $2.400.
   - Si NO tenemos reparto en la comuna:
     - Ofrecer entrega en nuestro domicilio Calle Chacabuco 1120, Santiago Centro.
4. Preguntar productos, sabores, cantidades y porciones del catálogo.
5. Luego pedir datos de despacho uno por uno.
6. Enviar resumen y pedir confirmación.
7. Al confirmar guardar pedido y enviar mensaje final con emoji verde (✅).
`;

// =====================================================
// 6. IA GPT-4o-mini
// =====================================================
async function askLunaAI({ session, userMessage }) {
  const contexto = {
    estado: session.state,
    comuna: session.comuna,
    cliente: session.customer,
    carrito: session.cart,
    entrega: session.delivery,
  };

  const systemMessage = `
Eres Luna. Sigue estrictamente el flujo y el catálogo.
Responde SIEMPRE en formato JSON válido:

{
 "reply": "",
 "state": "",
 "data": {
   "comuna": null,
   "productos": [],
   "datos_cliente": { "nombre": null, "direccion": null, "telefono_alt": null },
   "pedido_completo": false,
   "confirmado": false,
   "horario_entrega": null,
   "fecha_entrega": null
 }
}

${FLOW_RULES_TEXT}

CATÁLOGO COMPLETO:
${RULES_TEXT}
`;

  const messages = [
    { role: "system", content: systemMessage },
    ...session.history,
    {
      role: "user",
      content: `Mensaje: "${userMessage}". Contexto: ${JSON.stringify(contexto)}`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.2,
  });

  return completion.choices[0].message.content;
}

// =====================================================
// 7. ENDPOINT WHATSAPP (WHATAUTO)
// =====================================================
app.post("/whatsapp", async (req, res) => {
  console.log("📥 BODY:", req.body);

  const { phone, message } = req.body || {};

  if (!phone || !message) {
    return res.json({
      reply: "No pude leer tu mensaje, ¿puedes repetirlo por favor? 😊",
    });
  }

  const session = getSession(phone);
  pushHistory(session, "user", message);

  let aiRaw = await askLunaAI({ session, userMessage: message });

  console.log("🤖 RAW IA:", aiRaw);

  let ai;
  try {
    ai = JSON.parse(aiRaw);
  } catch {
    return res.json({ reply: "Hubo un error interpretando tu mensaje 😊" });
  }

  // Aplicar cambios a la sesión
  session.state = ai.state || session.state;

  if (ai.data?.comuna) session.comuna = ai.data.comuna;
  if (Array.isArray(ai.data?.productos)) session.cart = ai.data.productos;

  if (ai.data?.datos_cliente) {
    session.customer = { ...session.customer, ...ai.data.datos_cliente };
  }

  if (ai.data?.fecha_entrega) session.delivery.fecha_entrega = ai.data.fecha_entrega;
  if (ai.data?.horario_entrega) session.delivery.horario_aprox = ai.data.horario_entrega;

  const reply = ai.reply || "Estoy procesando tu mensaje 😊";

  pushHistory(session, "assistant", reply);

  return res.json({ reply });
});

// =======================
// 8. SERVIDOR HTTP
// =======================
app.get("/", (req, res) => {
  res.send("Luna Bot funcionando correctamente ✅");
});

app.listen(PORT, () => console.log(`🚀 Servidor listo en puerto ${PORT}`));
