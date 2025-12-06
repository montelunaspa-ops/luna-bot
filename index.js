// ============================================================================
// LUNA BOT - DELICIAS MONTE LUNA
// ARCHIVO: index.js (VERSIÓN LIMPIA Y FUNCIONAL)
// ============================================================================

// DEPENDENCIAS BÁSICAS
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// CONFIGURACIÓN BASE
const app = express();
const PORT = process.env.PORT || 3000;

console.log("🚀 Luna Bot iniciando…");

// Middleware
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// OpenAI
const openaiApiKey = process.env.OPENAI_API_KEY;
if (!openaiApiKey) {
  console.error("❌ ERROR: Falta OPENAI_API_KEY en .env");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: openaiApiKey });

// Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Faltan credenciales de Supabase");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================================
// SESIONES EN MEMORIA
// ============================================================================
const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      phone,
      comuna: null,
      cart: [],
      customer: { nombre: null, direccion: null, telefono_alt: null },
      delivery: { fecha_entrega: null, horario_aprox: null },
      history: [],
      state: "inicio",
      orderSaved: false,
      checkedClient: false,
      knownClient: false,
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

// ============================================================================
// CATÁLOGO Y REGLAS
// ============================================================================
const CATALOGO_TEXTO = `
CATÁLOGO OFICIAL DELICIAS MONTE LUNA

🍰 QUEQUES PERUANOS — $8.500
Sabores:
• Chocolate
• Marmoleado
• Piña
• Vainilla
• Naranja
• Maracuyá
Porciones: 14, 16 o sin cortar
Tamaño: 28 cm diámetro, 10 cm alto

🍪 GALLETAS Y DELICIAS (BANDEJA 20 UNIDADES) — $4.000
• Rellena de Manjar
• Alemana
• Giro Coco
• Almejitas
• Lengua de Gato
• Cocadas de Horno
• Alfajorcito
• Cachitos

🧁 MUFFINS
• Muffin Chips (6 unidades): $3.500
• Muffins Premium (6 unidades surtidas): $5.000

🤩 DELICIAS PREMIUM
• Alfajores Premium Maicena (12 und): $6.000
• Cachitos Manjar Premium (10 und): $6.000

📦 QUEQUE ARTESANAL RECTANGULAR — $3.000
Sabores: Vainilla Chips, Manzana, Arándanos
Oferta: 4 x $10.000

COMUNAS DE DESPACHO:
• Cerro Navia
• Cerrillos
• Conchalí
• Estación Central
• Independencia
• Lo Prado
• Lo Espejo (sector PAC)
• Maipú (sector Vespucio)
• Pedro Aguirre Cerda
• Pudahuel (sur/norte)
• Quinta Normal
• Recoleta
• Renca
• Santiago Centro
• San Miguel
• San Joaquín
`;

const FLOW_RULES = `
REGLAS GENERALES DEL FLUJO DE LUNA:

1. Siempre dar bienvenida al primer mensaje.
2. Si el cliente NO está registrado → mostrar catálogo y pedir comuna.
3. Validar comuna:
   • Si hay despacho → indicar horario.
   • Si NO hay → ofrecer retiro.
4. Tomar productos: preguntar cantidad, sabor, porciones si aplica.
5. Cuando el cliente diga que ya terminó → pedir datos uno por uno.
6. Mostrar resumen y solicitar confirmación.
7. Al confirmar → guardar pedido en Supabase.

Reglas extra:
• Responder SIEMPRE en JSON válido.
• Respuestas cortas, máximo 2 frases.
• Se permite agregar productos en cualquier momento.
• Si agrega productos después de confirmar → actualizar pedido.
`;

// ============================================================================
// GPT — FUNCIÓN PRINCIPAL
// ============================================================================
async function askLunaAI({ session, userMessage }) {
  const systemMessage = `
Eres Luna, asistente virtual de Delicias Monte Luna.
Debes seguir exactamente las reglas y catálogo.

${FLOW_RULES}

CATÁLOGO COMPLETO:
${CATÁLOGO_TEXTO}

FORMATO DE RESPUESTA OBLIGATORIO (SIEMPRE JSON):
{
  "reply": "texto",
  "state": "...",
  "data": {
    "comuna": null,
    "productos": [
      {
        "descripcion": "",
        "cantidad": 0,
        "categoria": "",
        "porciones": "",
        "sabor": ""
      }
    ],
    "datos_cliente": {
      "nombre": null,
      "direccion": null,
      "telefono_alt": null
    },
    "pedido_completo": false,
    "confirmado": false,
    "horario_entrega": null,
    "fecha_entrega": null
  }
}
`;

  const messages = [
    { role: "system", content: systemMessage },
    ...session.history,
    {
      role: "user",
      content: `Mensaje del cliente: "${userMessage}" 
Contexto: ${JSON.stringify(session)}`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.2,
  });

  return completion.choices[0].message.content;
}

// ============================================================================
// SUPABASE — CLIENTES Y PEDIDOS
// ============================================================================
async function upsertCliente(session) {
  const { phone, comuna, customer } = session;

  const { data, error } = await supabase
    .from("clientes")
    .upsert(
      {
        telefono: phone,
        nombre: customer.nombre,
        direccion: customer.direccion,
        telefono_alt: customer.telefono_alt,
        comuna,
      },
      { onConflict: "telefono" }
    )
    .select()
    .single();

  if (error) console.error("❌ Error guardando cliente:", error);
  else console.log("✅ Cliente guardado:", phone);
}

function normalizarFechaEntrega(valor) {
  if (!valor) return null;
  if (valor.toLowerCase() === "mañana") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }
  // Si viene como fecha válida
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  return null;
}

async function guardarPedido(session, resumen, dataAI) {
  const fechaEntrega = normalizarFechaEntrega(
    dataAI.fecha_entrega || session.delivery.fecha_entrega
  );

  const horario = dataAI.horario_entrega || session.delivery.horario_aprox;

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      cliente_telefono: session.phone,
      comuna: session.comuna,
      fecha_entrega: fechaEntrega,
      horario_aprox: horario,
      resumen_texto: resumen,
      estado: "pendiente",
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Error insertando pedido:", error);
    return;
  }

  console.log("✅ Pedido creado:", pedido.id);

  if (session.cart.length > 0) {
    const detalles = session.cart.map((p) => ({
      pedido_id: pedido.id,
      descripcion: p.descripcion,
      cantidad: p.cantidad,
      categoria: p.categoria,
    }));

    const { error: detErr } = await supabase
      .from("pedidos_detalle")
      .insert(detalles);

    if (detErr) console.error("❌ Error guardando detalle:", detErr);
    else console.log("✅ Detalle guardado.");
  }
}

// ============================================================================
// ENDPOINT PRINCIPAL WHATSAUTO
// ============================================================================
app.post("/whatsapp", async (req, res) => {
  const body = req.body;
  console.log("📥 BODY:", body);

  const { phone, message } = body;

  if (!phone || !message) {
    return res.json({ reply: "No entendí el mensaje, ¿puedes repetirlo?" });
  }

  const session = getSession(phone);

  pushHistory(session, "user", message);

  // SI ES CLIENTE NUEVO → CONSULTAR EN BD
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
      console.log("ℹ️ Cliente conocido:", phone);
    } else {
      console.log("ℹ️ Cliente nuevo:", phone);
    }

    session.checkedClient = true;
  }

  // IA
  let aiRaw;
  try {
    aiRaw = await askLunaAI({ session, userMessage: message });
    console.log("🤖 RAW IA:", aiRaw);
  } catch (err) {
    console.error("❌ Error IA:", err);
    return res.json({ reply: "Hubo un error, intenta nuevamente 🙏" });
  }

  let ai;
  try {
    ai = JSON.parse(aiRaw);
  } catch (err) {
    console.error("⚠️ JSON inválido de la IA:", aiRaw);
    return res.json({ reply: "No entendí, ¿puedes repetirlo?" });
  }

  const { reply, state, data } = ai;

  session.state = state || session.state;

  // Actualizar comuna
  if (data.comuna) session.comuna = data.comuna;

  // Actualizar productos
  if (Array.isArray(data.productos)) {
    session.cart = data.productos;
  }

  // Datos cliente
  if (data.datos_cliente) {
    session.customer = { ...session.customer, ...data.datos_cliente };
  }

  // Fecha / horario
  if (data.fecha_entrega)
    session.delivery.fecha_entrega = normalizarFechaEntrega(
      data.fecha_entrega
    );

  if (data.horario_entrega)
    session.delivery.horario_aprox = data.horario_entrega;

  // Confirmación
  if (data.confirmado && !session.orderSaved) {
    await upsertCliente(session);

    const resumen =
      "Pedido: " +
      session.cart.map((p) => `${p.cantidad} x ${p.descripcion}`).join(", ");

    await guardarPedido(session, resumen, data);

    session.orderSaved = true;
    session.state = "finalizado";

    pushHistory(session, "assistant", reply);
    return res.json({ reply });
  }

  pushHistory(session, "assistant", reply);

  return res.json({ reply });
});

// ============================================================================
// SERVIDOR
// ============================================================================
app.get("/", (req, res) => {
  res.send("Luna Bot está funcionando correctamente.");
});

app.listen(PORT, () =>
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`)
);
