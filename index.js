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
... (TODA TU SECCIÓN DEL CATÁLOGO — LA MISMA QUE ENVIASTE)
`;

// =====================================================
// 5. REGLAS DE FLUJO (PUNTOS 1 AL 7) PARA EL PROMPT
// =====================================================
const FLOW_RULES_TEXT = `
FLUJO OBLIGATORIO DEL BOT:
... (SE MANTIENE IGUAL)
`;

// =====================================================
// 6. HELPERS PARA FECHA DE ENTREGA
// =====================================================
function calcularFechaEntrega() {
  const hoy = new Date();
  let entrega = new Date(hoy);
  entrega.setDate(entrega.getDate() + 1);
  if (entrega.getDay() === 0) entrega.setDate(entrega.getDate() + 1);
  return entrega.toISOString().split("T")[0];
}

// =====================================================
// 7. IA GPT-4O-MINI
// =====================================================
async function askLunaAI({ session, userMessage }) {
  console.log("🤖 [IA INPUT] Texto enviado a IA:", userMessage);

  const contextoJSON = {
    estado_sesion: session.state,
    telefono: session.phone,
    cliente_conocido: session.knownClient ? "sí" : "no",
    comuna_actual: session.comuna,
    carrito_actual: session.cart,
    datos_cliente: session.customer,
    entrega: session.delivery,
  };

  const systemMessage = `
Eres Luna, asistente virtual...
(RESTO IGUAL)
`;

  const messages = [
    { role: "system", content: systemMessage },
    ...session.history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content: `Mensaje del cliente: "${userMessage}"\nContexto:\n${JSON.stringify(
        contextoJSON
      )}`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.2,
  });

  console.log("📄 [IA RAW] Respuesta sin procesar:", completion.choices[0]?.message?.content);

  return completion.choices[0]?.message?.content || "";
}

// =====================================================
// 8. GUARDADO EN BASE DE DATOS
// =====================================================
async function upsertClienteFromSession(session) {
  console.log("💾 [BD] Guardando cliente:", session.phone);

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

async function guardarPedidoCompleto(session, resumenTexto, dataAI) {
  console.log("💾 [BD] Guardando pedido completo…");

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

    console.log("💾 [BD] Pedido creado:", pedido?.id);

    if (pedido && Array.isArray(session.cart)) {
      const detalles = session.cart.map((item) => ({
        pedido_id: pedido.id,
        descripcion: item.descripcion || "",
        cantidad: item.cantidad || 1,
        categoria: item.categoria || null,
        precio_unitario: null,
      }));

      await supabase.from("pedidos_detalle").insert(detalles);
      console.log("💾 [BD] Detalled e pedido guardado.");
    }
  } catch (err) {
    console.error("❌ Error guardando pedido:", err);
  }
}

// =====================================================
// 9. ENDPOINT WHATSAUTO
// =====================================================
app.post("/whatsapp", async (req, res) => {
  console.log("📥 [RECIBIDO] Payload WhatsAuto:", req.body);

  const { phone, message } = req.body || {};

  if (!phone || !message) {
    return res.json({
      reply: "No pude leer tu mensaje, repítelo por favor 😊",
    });
  }

  const session = getSession(phone);
  console.log("🗂️ [SESION] Sesión cargada:", session);

  // Cargar cliente
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

      console.log("🟩 [SESION] Cliente encontrado en BD:", cliente);
    }

    session.checkedClient = true;
  }

  pushHistory(session, "user", message);

  let aiRawResponse;
  try {
    aiRawResponse = await askLunaAI({ session, userMessage: message });
  } catch (err) {
    return res.json({
      reply: "Error temporal, intenta de nuevo 🙏",
    });
  }

  let ai;
  try {
    ai = JSON.parse(aiRawResponse);
    console.log("📦 [IA JSON] Interpretado:", ai);
  } catch {
    return res.json({
      reply: "No logré entenderte, repite por favor 😊",
    });
  }

  const replyText = ai.reply || "Listo 😊";
  const data = ai.data || {};
  session.state = ai.state || session.state;

  if (data.comuna) session.comuna = data.comuna;
  if (data.productos) session.cart = data.productos;
  if (data.datos_cliente)
    session.customer = { ...session.customer, ...data.datos_cliente };
  if (data.fecha_entrega) session.delivery.fecha_entrega = data.fecha_entrega;
  if (data.horario_entrega) session.delivery.horario_aprox = data.horario_entrega;

  if (data.confirmado && !session.orderSaved) {
    await upsertClienteFromSession(session);

    const resumen =
      session.cart.map((p) => `${p.cantidad || 1} x ${p.descripcion}`).join(", ");

    await guardarPedidoCompleto(session, resumen, data);

    session.orderSaved = true;
    session.state = "finalizado";
  }

  pushHistory(session, "assistant", replyText);

  console.log("📤 [ENVIADO] Respuesta al cliente:", replyText);

  return res.json({ reply: replyText });
});

// =======================
// 10. SERVIDOR HTTP
// =======================
app.get("/", (req, res) => {
  res.send("Luna Bot funcionando con logs completos 🔥");
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
});
