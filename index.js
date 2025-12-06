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

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

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
//
// Estructura aproximada de una sesión:
// {
//   phone: "+569...",
//   knownClient: false,
//   checkedClient: false,
//   comuna: null,
//   cart: [],
//   customer: { nombre: null, direccion: null, telefono_alt: null },
//   delivery: { fecha_entrega: null, horario_aprox: null },
//   state: "inicio" | "preguntar_comuna" | "pedidos" | "datos_despacho" | "confirmacion" | "finalizado",
//   orderSaved: false,
//   history: [{ role: "user"|"assistant", content: "..." }]
// }
const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      phone,
      knownClient: false,
      checkedClient: false,
      comuna: null,
      cart: [],
      customer: {
        nombre: null,
        direccion: null,
        telefono_alt: null,
      },
      delivery: {
        fecha_entrega: null,
        horario_aprox: null,
      },
      state: "inicio",
      orderSaved: false,
      history: [],
    };
  }
  return sessions[phone];
}

function pushHistory(session, role, content) {
  session.history.push({ role, content });
  // Limitar historial por sesión
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
// 5. REGLAS DE FLUJO (PUNTOS 1 AL 7) PARA EL PROMPT
// =====================================================
const FLOW_RULES_TEXT = `
FLUJO OBLIGATORIO DEL BOT (LUNA):

1. En el momento que se reciba cualquier mensaje se da la bienvenida.
2. Se valida el número de WhatsApp en la base de datos clientes:
   - Si está en la base de datos clientes se omite el paso 3 y el paso 5.
   - Si no está en la base de datos clientes se envía el catálogo y se pregunta para que comuna será despachado el pedido.
3. Se valida la comuna que este dentro de las comunas con reparto:
   - Si está se informa el horario aproximado de entrega.
   - Se le informa que no hay compra mínima.
   - Que el despacho es gratuito por compras mayores a $14.990.
   - Si la compra es menor el despacho sale en $2.400.
   - Si NO tenemos reparto se ofrece entrega en Calle Chacabuco 1120, Santiago Centro.
     - Si acepta → paso 4.
     - Si no acepta → despedir amablemente.
4. Preguntar productos, sabores, cantidades, porciones SOLO del catálogo.
5. Al finalizar el pedido → solicitar datos de despacho uno por uno:
   - Nombre y apellido
   - Dirección
   - Teléfono adicional
6. Cuando el pedido esté completo → enviar resumen + datos despacho + fecha + horario.
7. Si el cliente confirma → guardar en BD y enviar emoji de check verde (✅).

Respuestas siempre cortas y concisas.
`;

// =====================================================
// 6. HELPER PARA FECHA DE ENTREGA
// =====================================================
function calcularFechaEntrega() {
  const hoy = new Date();
  let entrega = new Date(hoy);
  entrega.setDate(entrega.getDate() + 1);
  if (entrega.getDay() === 0) entrega.setDate(entrega.getDate() + 1);
  return entrega.toISOString().split("T")[0];
}

// =====================================================
// 7. LLAMADO A GPT-4O-MINI
// =====================================================
async function askLunaAI({ session, userMessage }) {
  const contexto = {
    estado_sesion: session.state,
    telefono: session.phone,
    cliente_conocido: session.knownClient,
    comuna_actual: session.comuna,
    carrito_actual: session.cart,
    datos_cliente: session.customer,
    entrega: session.delivery,
  };

  const systemMessage = `
Eres Luna, asistente virtual de Delicias Monte Luna. 
Debes seguir estrictamente el flujo siguiente:

${FLOW_RULES_TEXT}

Usa este catálogo y reglas SIN modificar nada:

${RULES_TEXT}

Formato ESTRICTO de respuesta JSON:
{
  "reply": "texto corto",
  "state": "",
  "data": {
    "comuna": "",
    "productos": [],
    "datos_cliente": {
      "nombre": "",
      "direccion": "",
      "telefono_alt": ""
    },
    "pedido_completo": false,
    "confirmado": false,
    "horario_entrega": "",
    "fecha_entrega": ""
  }
}
`;

  const messages = [
    { role: "system", content: systemMessage },
    ...session.history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content: `Mensaje del cliente: "${userMessage}". Contexto: ${JSON.stringify(
        contexto
      )}`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.2,
  });

  return completion.choices[0]?.message?.content || "";
}

// =====================================================
// 8. GUARDADO CLIENTE
// =====================================================
async function upsertClienteFromSession(session) {
  const { phone, customer, comuna } = session;
  const { nombre, direccion, telefono_alt } = customer || {};

  await supabase.from("clientes").upsert(
    {
      telefono: phone,
      nombre: nombre || null,
      direccion: direccion || null,
      comuna: comuna || null,
      telefono_alt: telefono_alt || null,
    },
    { onConflict: "telefono" }
  );
}

// =====================================================
// 9. GUARDAR PEDIDO Y DETALLES
// =====================================================
async function guardarPedidoCompleto(session, resumenTexto, dataAI) {
  try {
    const fecha_entrega =
      dataAI?.fecha_entrega || session.delivery.fecha_entrega || calcularFechaEntrega();

    const horario_entrega =
      dataAI?.horario_entrega || session.delivery.horario_aprox || null;

    const { data: pedido } = await supabase
      .from("pedidos")
      .insert({
        cliente_telefono: session.phone,
        comuna: session.comuna,
        fecha_entrega,
        horario_aprox: horario_entrega,
        resumen_texto: resumenTexto,
        total_estimado: null,
        estado: "pendiente",
      })
      .select()
      .single();

    if (pedido && Array.isArray(session.cart)) {
      const detalles = session.cart.map((item) => ({
        pedido_id: pedido.id,
        descripcion: item.descripcion || "",
        cantidad: item.cantidad || 1,
        categoria: item.categoria || null,
        precio_unitario: null,
      }));

      await supabase.from("pedidos_detalle").insert(detalles);
    }
  } catch (err) {
    console.error("❌ Error guardando pedido:", err);
  }
}

// =====================================================
// 10. ENDPOINT PRINCIPAL WHATSAUTO
// =====================================================
app.post("/whatsapp", async (req, res) => {
  console.log("📩 [WEBHOOK] Payload recibido:", req.body);

  const { phone, message } = req.body || {};

  if (!phone || !message) {
    return res.json({
      reply:
        "Hola, soy Luna de Delicias Monte Luna. No pude leer tu mensaje, ¿puedes repetirlo por favor? 😊",
    });
  }

  const session = getSession(phone);

  // Buscar cliente solo 1 vez
  if (!session.checkedClient) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("*")
      .eq("telefono", phone)
      .maybeSingle();

    if (cliente) {
      session.knownClient = true;
      session.customer.nombre = cliente.nombre;
      session.customer.direccion = cliente.direccion;
      session.customer.telefono_alt = cliente.telefono_alt;
      session.comuna = cliente.comuna;
    }

    session.checkedClient = true;
  }

  pushHistory(session, "user", message);

  let aiRaw = "";
  try {
    aiRaw = await askLunaAI({ session, userMessage: message });
  } catch (err) {
    console.error("❌ Error IA:", err);
    return res.json({ reply: "Hubo un pequeño error, intenta nuevamente 🙏" });
  }

  let ai;
  try {
    ai = JSON.parse(aiRaw);
  } catch (err) {
    console.error("⚠️ JSON inválido:", aiRaw);
    return res.json({
      reply: "No entendí bien, ¿puedes repetirlo por favor? 😊",
    });
  }

  const replyText = ai.reply || "Listo 😊";
  const nextState = ai.state || session.state;
  const data = ai.data || {};

  session.state = nextState;

  if (data.comuna) session.comuna = data.comuna;
  if (Array.isArray(data.productos)) session.cart = data.productos;
  if (data.datos_cliente)
    session.customer = { ...session.customer, ...data.datos_cliente };
  if (data.fecha_entrega) session.delivery.fecha_entrega = data.fecha_entrega;
  if (data.horario_entrega) session.delivery.horario_aprox = data.horario_entrega;

  const pedidoCompleto = data.pedido_completo || false;
  const confirmado = data.confirmado || false;

  if (confirmado && !session.orderSaved) {
    await upsertClienteFromSession(session);

    const resumen =
      session.cart.map((p) => `${p.cantidad || 1} x ${p.descripcion}`).join(", ");

    await guardarPedidoCompleto(session, resumen, data);

    session.orderSaved = true;
    session.state = "finalizado";
  }

  pushHistory(session, "assistant", replyText);

  return res.json({ reply: replyText });
});

// =======================
// 11. SERVIDOR HTTP
// =======================
app.get("/", (req, res) => {
  res.send("Luna Bot - Delicias Monte Luna está funcionando SIN CORS ✅");
});

app.listen(PORT, () => {
  console.log(`🚀 Luna Bot escuchando SIN CORS en el puerto ${PORT}`);
});
