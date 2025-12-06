// ============================================================================
// LUNA BOT - DELICIAS MONTE LUNA
// index.js COMPLETO — versión estable con logs y sin parches basura
// ============================================================================

// --------------------------- DEPENDENCIAS ----------------------------------
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// --------------------------- CONFIGURACIÓN ---------------------------------
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

console.log("🚀 Luna Bot iniciando...");

// WhatsAuto envía x-www-form-urlencoded
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// --------------------------- OPENAI ----------------------------------------
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error("❌ ERROR: Falta OPENAI_API_KEY en el archivo .env");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });

// --------------------------- SUPABASE --------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ ERROR: Falta SUPABASE_URL o SUPABASE_KEY en .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --------------------------- SESIONES --------------------------------------
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
        telefono_alt: null
      },
      delivery: { fecha_entrega: null, horario_aprox: null },
      state: "inicio",
      orderSaved: false,
      history: []
    };

    console.log(`🆕 Nueva sesión creada para ${phone}`);
  }
  return sessions[phone];
}

function pushHistory(session, role, content) {
  session.history.push({ role, content });

  if (session.history.length > 10) {
    session.history = session.history.slice(-10);
  }
}

// --------------------------- CATÁLOGO --------------------------------------
const RULES_TEXT = `

(… EL CATÁLOGO COMPLETO QUE YA TENÍAS, SIN CAMBIOS …)

`;

// --------------------------- REGLAS DEL FLUJO -------------------------------
const FLOW_RULES_TEXT = `

(… TEXTO COMPLETO DEL FLUJO QUE YA TENÍAS, SIN CAMBIOS …)

`;

// --------------------------- FECHA ENTREGA ---------------------------------
function calcularFechaEntrega() {
  const hoy = new Date();
  let entrega = new Date(hoy);

  entrega.setDate(entrega.getDate() + 1);

  if (entrega.getDay() === 0) entrega.setDate(entrega.getDate() + 1);

  return entrega.toISOString().split("T")[0];
}

// --------------------------- IA --------------------------------------------
async function askLunaAI({ session, userMessage }) {
  console.log("🤖 Enviando mensaje a OpenAI…");
  console.log("📤 Mensaje usuario:", userMessage);

  const systemMessage = `
Eres Luna, asistente virtual…
${FLOW_RULES_TEXT}
${RULES_TEXT}

FORMATO JSON OBLIGATORIO:
{
 "respuesta": "texto corto",
 "accion": "string",
 "data": { … }
}
`;

  const messages = [
    { role: "system", content: systemMessage },
    ...session.history,
    { role: "user", content: userMessage }
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.2
  });

  const raw = completion.choices[0]?.message?.content || "";
  console.log("🤖 RAW IA:", raw);

  return raw;
}

// --------------------------- GUARDADO BD -----------------------------------
async function upsertClienteFromSession(session) {
  console.log("💾 Guardando cliente…", session.phone);

  const { phone, comuna, customer } = session;
  const { nombre, direccion, telefono_alt } = customer;

  const { data, error } = await supabase
    .from("clientes")
    .upsert(
      {
        telefono: phone,
        nombre: nombre || null,
        direccion: direccion || null,
        comuna: comuna || null,
        telefono_alt: telefono_alt || null
      },
      { onConflict: "telefono" }
    )
    .select()
    .single();

  if (error) console.error("❌ Error guardando cliente:", error);
  else console.log("✅ Cliente guardado:", phone);
}

async function guardarPedidoCompleto(session, resumenTexto) {
  console.log("💾 Guardando pedido completo…");

  const fecha_entrega = session.delivery.fecha_entrega || calcularFechaEntrega();
  const horario_entrega = session.delivery.horario_aprox;

  // Validación extra
  let fecha = fecha_entrega;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    console.warn("⚠ Fecha inválida enviada por IA:", fecha);
    fecha = calcularFechaEntrega();
  }

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      cliente_telefono: session.phone,
      comuna: session.comuna,
      fecha_entrega: fecha,
      horario_aprox: horario_entrega || null,
      resumen_texto: resumenTexto,
      estado: "pendiente"
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Error insertando pedido:", error);
    return;
  }

  console.log("🎉 Pedido agendado con éxito.");
}

// ============================================================================
//                           FIN BLOQUE 1
// ============================================================================

// ============================================================================
// BLOQUE 2 / 3 — ENDPOINT PRINCIPAL /WHATSAPP + PROCESAMIENTO IA
// ============================================================================

app.post("/whatsapp", async (req, res) => {
  console.log("📥 BODY:", req.body);

  const { phone, message } = req.body || {};

  if (!phone || !message) {
    console.log("⚠️ Payload incompleto:", req.body);
    return res.json({
      reply:
        "Hola 😊 No pude leer tu mensaje correctamente. ¿Podrías enviarlo nuevamente?"
    });
  }

  const session = getSession(phone);

  // -------------------------------------------------------------------------
  // 1) Cargar cliente en BD solo UNA VEZ POR SESIÓN
  // -------------------------------------------------------------------------
  if (!session.checkedClient) {
    console.log("🔍 Buscando cliente en BD:", phone);

    try {
      const { data: cliente, error } = await supabase
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

        console.log("ℹ️ Cliente encontrado:", cliente.telefono);
      } else {
        console.log("🆕 Cliente nuevo:", phone);
      }

      session.checkedClient = true;
    } catch (err) {
      console.error("❌ Error consultando cliente:", err);
    }
  }

  // Guardar historial
  pushHistory(session, "user", message);

  // -------------------------------------------------------------------------
  // 2) LLAMAR A LA IA
  // -------------------------------------------------------------------------
  let aiRaw;
  try {
    aiRaw = await askLunaAI({ session, userMessage: message });
  } catch (err) {
    console.error("❌ Error OpenAI:", err);
    return res.json({
      reply: "Estoy teniendo un problema técnico 😥 ¿Puedes intentar nuevamente?"
    });
  }

  // -------------------------------------------------------------------------
  // 3) Parsear JSON
  // -------------------------------------------------------------------------
  let ai;
  try {
    ai = JSON.parse(aiRaw);
  } catch (err) {
    console.error("⚠️ IA envió JSON inválido.");
    console.log("📄 RAW IA:", aiRaw);

    pushHistory(session, "assistant", aiRaw);

    return res.json({
      reply:
        "Perdón 😓 hubo un problema procesando tu mensaje. ¿Puedes escribirlo de otro modo?"
    });
  }

  console.log("🤖 IA PARSEADA:", ai);

  // -------------------------------------------------------------------------
  // 4) Procesar la respuesta de la IA
  // -------------------------------------------------------------------------
  const replyText = ai.respuesta || "Listo 😊";
  const accion = ai.accion || null;
  const data = ai.data || {};

  // -------------------------------------------
  // Actualizar comuna
  // -------------------------------------------
  if (data.comuna) {
    session.comuna = data.comuna;
    console.log("📍 Comuna actual:", session.comuna);
  }

  // -------------------------------------------
  // Manejar productos agregados
  // -------------------------------------------
  if (Array.isArray(data.productos) && data.productos.length > 0) {
    console.log("🛒 Productos recibidos:", data.productos);

    for (const p of data.productos) {
      const existente = session.cart.find(
        (x) =>
          x.categoria === p.categoria &&
          x.sabor === p.sabor &&
          x.porcion === p.porcion
      );

      if (existente) {
        existente.cantidad += p.cantidad;
        console.log("🔄 Merge cantidades:", existente);
      } else {
        session.cart.push(p);
        console.log("➕ Producto agregado:", p);
      }
    }
  }

  // -------------------------------------------
  // Actualizar datos de despacho
  // -------------------------------------------
  if (data.datos_cliente) {
    session.customer = { ...session.customer, ...data.datos_cliente };
    console.log("👤 Datos cliente:", session.customer);
  }

  if (data.fecha_entrega) {
    session.delivery.fecha_entrega = data.fecha_entrega;
  }

  if (data.horario_entrega) {
    session.delivery.horario_aprox = data.horario_entrega;
  }

  // -------------------------------------------
  // Si IA indica pedido completo → confirmar
  // -------------------------------------------
  const pedidoCompleto = data.pedido_completo || false;
  const confirmado = data.confirmado || false;

  // -------------------------------------------------------------------------
  // 5) GUARDAR PEDIDO CUANDO SE CONFIRME
  // -------------------------------------------------------------------------
  if (confirmado) {
    console.log("🧾 Pedido confirmado por el cliente");

    await upsertClienteFromSession(session);

    const resumenTexto =
      `Pedido para ${session.phone}: ` +
      session.cart.map((p) => `${p.cantidad}x ${p.producto} ${p.sabor}`).join(", ");

    await guardarPedidoCompleto(session, resumenTexto);

    session.orderSaved = true;
    session.state = "finalizado";
  }

  // Registrar historial
  pushHistory(session, "assistant", replyText);

  // -------------------------------------------------------------------------
  // 6) RESPUESTA FINAL
  // -------------------------------------------------------------------------
  return res.json({ reply: replyText });
});

// ============================================================================
// FIN BLOQUE 2 / 3
// ============================================================================

// ============================================================================
// BLOQUE 3 / 3 — SERVIDOR HTTP
// ============================================================================

app.get("/", (req, res) => {
  res.send("Luna Bot funcionando correctamente ✅");
});

app.listen(PORT, () =>
  console.log(`🚀 Servidor levantado en puerto ${PORT}`)
);

// ============================================================================
// FIN TOTAL DEL ARCHIVO
// ============================================================================
