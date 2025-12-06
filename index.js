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

// Parsers para soportar WhatsAuto en cualquier formato
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(bodyParser.text({ type: "*/*" }));

// Log RAW
app.use((req, res, next) => {
  console.log("📥 [RAW BODY ENTRANTE]:", req.body);
  console.log("📥 [HEADERS]:", req.headers);
  next();
});

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

• 🍰 Queques Peruanos
Sabores disponibles:
o Chocolate
o Marmoleado
o Piña
o Vainilla
o Naranja
o Maracuyá
Porciones: 14, 16 o sin cortar
Tamaño: 28 cm de diámetro, 10 cm de alto aproximadamente
Precio: $8.500

• 🍪 Galletas y Delicias en Bandeja de 20 Unidades
o Rellena de Manjar
o Alemana
o Giro Coco
o Almejitas 
o Lengua de Gato
o Cocadas de Horno
o Alfajorcito
o Cachitos
Precio: $4.000 (Bandeja por cada producto, no son surtidas)

• 🧁 Muffins
o Muffin Chips (6 Unidades, empaque individual): $3.500
o Muffins Premium Sabores Surtidos (6 Unidades, incluye: 1 Chocolate, 1 Red Velvet, 1 Arándano, 1 Coco, 2 Chips): $5.000

• 🤩 Delicias Premium
o Alfajores Premium de Maicena (12 Unidades, 8-9 cm): $6.000
o Cachitos Manjar Premium (10 Unidades, 11-12 cm): $6.000

• 📦 Queque Artesanal Rectangular
o Sabores: Vainilla Chips, Manzana, Arándanos 
Rectangular de 20 cm
Precio: $3.000
Oferta: 4 Unidades por $10.000 (sabores a tu elección)
Las entregas se realizan al día siguiente de realizar el pedido, excepto los domingos.
¿En qué comuna vamos a despachar?

Comunas de despacho
• Cerro Navia
• Cerrillos
• Conchalí
• Estación Central
• Independencia
• Lo Prado
• Lo Espejo (si es cerca de pedro Aguirre cerda y antes de Avenida Vespucio)
• Maipú (si es antes de Avenida Vespucio entre estación central y cerrillos)
• Pedro Aguirre Cerda
• Pudahuel (sur y norte)
• Quinta Normal
• Recoleta
• Renca
• Santiago Centro
• San Miguel
• San Joaquín

Horarios aproximados de entrega por comuna
• Cerro Navia: 11-13 hrs
• Cerrillos: 11-13 hrs
• Conchalí: 12-14 hrs
• Estación Central: 9-11 hrs
• Independencia: 11-14 hrs
• Lo Prado: 11-13 hrs
• Lo Espejo: 10-12 hrs
• Maipú: 10-12 hrs
• Pedro Aguirre Cerda: 10-12 hrs
• Pudahuel: 12-14 hrs
• Quinta Normal: 10-13 hrs
• Recoleta: 11-13 hrs
• Renca: 10-13 hrs
• Santiago Centro: 9-11 hrs
• San Miguel: 10-12 hrs
• San Joaquín: 10-12 hrs

Información adicional y reglas
• Domingos no se hacen despachos; pedidos recibidos el sábado y domingo se despachan el lunes
• Estamos ubicados en Calle Chacabuco 1120, Santiago Centro
• Entregas por ruta con varios pedidos, hora exacta de entrega no garantizada
• Métodos de pago: efectivo o débito
• Entregas presenciales al día siguiente
`;

// =====================================================
// 5. REGLAS DE FLUJO (PUNTOS 1 AL 7)
// =====================================================
const FLOW_RULES_TEXT = `
FLUJO OBLIGATORIO DEL BOT (LUNA):

1. En el momento que se reciba cualquier mensaje se da la bienvenida.
2. Se valida el número de WhatsApp en la base de datos clientes.
3. Se valida la comuna.
4. Se preguntan los productos.
5. Se piden los datos de despacho.
6. Se envía resumen y se pide confirmación.
7. Al confirmar, se guarda pedido y se cierra con un check verde.
`;

// =====================================================
// 6. HELPERS
// =====================================================
function calcularFechaEntrega() {
  const hoy = new Date();
  let entrega = new Date(hoy);
  entrega.setDate(entrega.getDate() + 1);
  if (entrega.getDay() === 0) entrega.setDate(entrega.getDate() + 1);
  return entrega.toISOString().split("T")[0];
}

// =====================================================
// 7. LLAMADO A GPT
// =====================================================
async function askLunaAI({ session, userMessage }) {
  const contextoJSON = {
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
Debes seguir el flujo de ventas y responder en JSON válido.

${FLOW_RULES_TEXT}
${RULES_TEXT}
`;

  const messages = [
    { role: "system", content: systemMessage },
    ...session.history,
    {
      role: "user",
      content: `Mensaje del cliente: "${userMessage}".\nContexto:\n${JSON.stringify(
        contextoJSON
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
// 8. GUARDAR EN SUPABASE
// =====================================================
async function upsertClienteFromSession(session) {
  const { phone, customer, comuna } = session;
  const { nombre, direccion, telefono_alt } = customer;

  await supabase
    .from("clientes")
    .upsert(
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

async function guardarPedidoCompleto(session, resumenTexto, dataAI) {
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
      estado: "pendiente",
    })
    .select()
    .single();

  if (Array.isArray(session.cart)) {
    const detalles = session.cart.map((p) => ({
      pedido_id: pedido.id,
      descripcion: p.descripcion,
      cantidad: p.cantidad,
      categoria: p.categoria,
    }));

    await supabase.from("pedidos_detalle").insert(detalles);
  }
}

// =====================================================
// 9. ENDPOINT PARA WHATSAUTO
// =====================================================
app.post("/whatsapp", async (req, res) => {
  console.log("📥 [PAYLOAD BRUTO]:", req.body);

  let payload = req.body;

  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      console.log("⚠️ No se pudo parsear JSON");
    }
  }

  console.log("📥 [PAYLOAD PROCESADO]:", payload);

  const phone = payload.phone;
  const message = payload.message;

  if (!phone || !message) {
    return res.json({
      reply:
        "Hola, soy Luna de Delicias Monte Luna. No pude leer tu mensaje. ¿Puedes enviarlo de nuevo? 😊",
    });
  }

  const session = getSession(phone);

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

      console.log("✅ Cliente existente:", phone);
    } else {
      console.log("ℹ️ Cliente nuevo:", phone);
    }

    session.checkedClient = true;
  }

  pushHistory(session, "user", message);

  let aiRaw;
  try {
    aiRaw = await askLunaAI({ session, userMessage: message });
    console.log("🤖 [IA RAW RESPONSE]:", aiRaw);
  } catch (err) {
    return res.json({
      reply: "Estoy teniendo un problema técnico. ¿Puedes intentar más tarde? 🙏",
    });
  }

  let ai;
  try {
    ai = JSON.parse(aiRaw);
    console.log("🧠 [IA PARSED JSON]:", ai);
  } catch (err) {
    return res.json({ reply: aiRaw });
  }

  const replyText = ai.reply;
  const nextState = ai.state;
  const data = ai.data || {};

  console.log("💬 [LUNA → CLIENTE]:", replyText);

  session.state = nextState;

  if (data.comuna) session.comuna = data.comuna;
  if (Array.isArray(data.productos)) session.cart = data.productos;
  if (data.datos_cliente)
    session.customer = { ...session.customer, ...data.datos_cliente };
  if (data.fecha_entrega) session.delivery.fecha_entrega = data.fecha_entrega;
  if (data.horario_entrega) session.delivery.horario_aprox = data.horario_entrega;

  console.log("📌 [NUEVO ESTADO]:", session.state);
  console.log("🛒 [CARRITO]:", session.cart);
  console.log("👤 [DATOS CLIENTE]:", session.customer);
  console.log("🚚 [ENTREGA]:", session.delivery);

  const confirmado = !!data.confirmado;

  if (confirmado && !session.orderSaved) {
    await upsertClienteFromSession(session);

    const resumenTexto =
      `Resumen del pedido: ` +
      (session.cart || [])
        .map((p) => `${p.cantidad} x ${p.descripcion}`)
        .join(", ");

    await guardarPedidoCompleto(session, resumenTexto, data);

    session.orderSaved = true;
    session.state = "finalizado";
  }

  pushHistory(session, "assistant", replyText);

  return res.json({ reply: replyText });
});

// =======================
// 10. SERVIDOR HTTP
// =======================
app.get("/", (req, res) => {
  res.send("Luna Bot - Delicias Monte Luna está funcionando ✅");
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
});
