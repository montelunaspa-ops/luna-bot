// ============================================================================
// LUNA BOT - DELICIAS MONTE LUNA
// ARCHIVO: index.js
// BLOQUE 1 / 3
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

// Permite recibir JSON y x-www-form-urlencoded (WhatsAuto lo requiere)
app.use(bodyParser.json({ limit: "5mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Faltan SUPABASE_URL o SUPABASE_KEY en .env");
}
const supabase = createClient(supabaseUrl, supabaseKey);

// SESIONES EN MEMORIA
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

// ============================================================================
// CATÁLOGO (FORMATO TABULADO Y LIMPIO)
// ============================================================================

const RULES_TEXT = `
¡Hola! Soy Luna, asistente virtual de Delicias Monte Luna. 🌙✨
Puedes hacer tu pedido fácilmente por la página www.monteluna.cl o por WhatsApp.

Catálogo:

🍰 Queques Peruanos
    • Sabores:
        - Chocolate
        - Marmoleado
        - Piña
        - Vainilla
        - Naranja
        - Maracuyá
    • Porciones:
        - 14
        - 16
        - Sin cortar
    • Tamaño:
        - 28 cm de diámetro
        - 10 cm de alto aprox.
    • Precio: $8.500

🍪 Galletas y Delicias (Bandeja 20 unidades)
    • Sabores:
        - Rellena de Manjar
        - Alemana
        - Giro Coco
        - Almejitas
        - Lengua de Gato
        - Cocadas de Horno
        - Alfajorcito
        - Cachitos
    • Precio: $4.000 por bandeja (no surtidas)

🧁 Muffins
    • Muffin Chips
        - 6 unidades
        - Empaque individual
        - Precio: $3.500
    • Muffins Premium Surtidos
        - 6 unidades
        - 1 Chocolate
        - 1 Red Velvet
        - 1 Arándano
        - 1 Coco
        - 2 Chips
        - Precio: $5.000

🤩 Delicias Premium
    • Alfajores Premium de Maicena
        - 12 unidades (8–9 cm)
        - Precio: $6.000
    • Cachitos Manjar Premium
        - 10 unidades (11–12 cm)
        - Precio: $6.000

📦 Queque Artesanal Rectangular
    • Sabores:
        - Vainilla Chips
        - Manzana
        - Arándanos
    • Tamaño: Rectangular 20 cm
    • Precio: $3.000
    • Oferta: 4 unidades por $10.000 (sabores a elección)

Las entregas se realizan al día siguiente, excepto domingos.
¿En qué comuna vamos a despachar?

Comunas con reparto:
    • Cerro Navia
    • Cerrillos
    • Conchalí
    • Estación Central
    • Independencia
    • Lo Prado
    • Lo Espejo (zona PAC antes de Vespucio)
    • Maipú (zona EC-Cerrillos antes de Vespucio)
    • Pedro Aguirre Cerda
    • Pudahuel (sur y norte)
    • Quinta Normal
    • Recoleta
    • Renca
    • Santiago Centro
    • San Miguel
    • San Joaquín

Horarios aproximados:
    • Cerro Navia: 11–13h
    • Cerrillos: 11–13h
    • Conchalí: 12–14h
    • Est. Central: 9–11h
    • Independencia: 11–14h
    • Lo Prado: 11–13h
    • Lo Espejo: 10–12h
    • Maipú: 10–12h
    • PAC: 10–12h
    • Pudahuel: 12–14h
    • Quinta Normal: 10–13h
    • Recoleta: 11–13h
    • Renca: 10–13h
    • Santiago Centro: 9–11h
    • San Miguel: 10–12h
    • San Joaquín: 10–12h

Información adicional:
    • Domingos no se realizan despachos.
    • Ubicación retiro: Calle Chacabuco 1120, Santiago Centro.
    • Métodos de pago: efectivo o débito.
`;

// ============================================================================
// REGLAS DE FLUJO AVANZADO (CON TODAS TUS DECISIONES INCLUIDAS)
// ============================================================================

const FLOW_RULES_TEXT = `
REGLAS PRINCIPALES:
• La IA SIEMPRE responde en JSON válido.
• Puede responder cualquier pregunta del cliente y luego vuelve al flujo.
• Si el cliente da saludos → responder amable.
• Si el cliente pregunta cosas fuera del catálogo → responder que solo puede asistir con pedidos.
• Flujo flexible: el cliente puede agregar productos en cualquier momento.
• Sub-flujo de modificación: si agrega algo después de confirmar, se actualiza resumen y se pide confirmación otra vez.

MANEJO DE PRODUCTOS:
• Si falta sabor → preguntar sabor.
• Si falta porción → preguntar porción.
• Si falta cantidad → preguntar cantidad.
• Si el producto no existe → decir que no existe y mostrar opciones (tu elección: A).
• Merge automático: si repite un producto con mismo sabor y porción → se suman cantidades.

RESUMEN:
• Formato estilo supermercado compacto:
      2x Queque Chocolate (14)
      1x Giro Coco
      1x Queque Vainilla (16)

ESTADOS:
• inicio
• preguntar_comuna
• productos
• datos_cliente
• confirmacion
• finalizado

JSON OBLIGATORIO:
{
  "reply": "...",
  "state": "...",
  "data": {
      "comuna": "...",
      "productos": [...],
      "datos_cliente": {...},
      "pedido_completo": true|false,
      "confirmado": true|false,
      "horario_entrega": "...",
      "fecha_entrega": "YYYY-MM-DD"
  }
}
`;
// ============================================================================
// BLOQUE 2 / 3 — IA: askLunaAI() + Limpieza y Merge Avanzado
// ============================================================================

// Helper: fecha de entrega corregida (nunca "mañana")
function calcularFechaEntregaCorregida() {
  const hoy = new Date();
  const entrega = new Date(hoy);
  entrega.setDate(entrega.getDate() + 1);

  if (entrega.getDay() === 0) {
    entrega.setDate(entrega.getDate() + 1);
  }

  return entrega.toISOString().split("T")[0];
}

// Limpieza de productos para evitar errores IA
function normalizarProductos(lista) {
  if (!Array.isArray(lista)) return [];

  return lista
    .map((p) => {
      if (!p) return null;

      // Normaliza campos
      const prod = {
        producto: p.producto || p.descripcion || null,
        sabor: p.sabor || null,
        porcion: p.porcion || null,
        cantidad: Number(p.cantidad || 1),
      };

      // Si no hay producto → ignorar
      if (!prod.producto) return null;

      return prod;
    })
    .filter(Boolean);
}

// Merge compacto estilo supermercado
function mergeProductos(lista) {
  const out = [];

  for (const p of lista) {
    const match = out.find(
      (x) =>
        x.producto?.toLowerCase() === p.producto?.toLowerCase() &&
        (x.sabor || "").toLowerCase() === (p.sabor || "").toLowerCase() &&
        (x.porcion || "").toLowerCase() === (p.porcion || "").toLowerCase()
    );

    if (match) {
      match.cantidad += p.cantidad;
    } else {
      out.push({ ...p });
    }
  }

  return out;
}

// Convertir carrito a formato IA esperado
function prepararCarritoParaIA(cart) {
  return cart.map((p) => ({
    descripcion: `${p.producto}${p.sabor ? " " + p.sabor : ""}${
      p.porcion ? " (" + p.porcion + ")" : ""
    }`,
    cantidad: p.cantidad,
    categoria: "producto",
  }));
}

// ============================================================================
// FUNCIÓN askLunaAI()
// ============================================================================

async function askLunaAI({ session, userMessage }) {
  console.log("🧠 [IA] Generando respuesta para:", userMessage);

  const contextoJSON = {
    estado: session.state,
    telefono: session.phone,
    cliente_conocido: session.knownClient ? "sí" : "no",
    comuna_actual: session.comuna,
    carrito: session.cart,
    datos_cliente: session.customer,
    entrega: session.delivery,
  };

  const systemMessage = `
Eres LUNA, asistente virtual de Delicias Monte Luna.

SIGUES ESTAS REGLAS:
${FLOW_RULES_TEXT}

CATÁLOGO COMPLETO:
${RULES_TEXT}

INSTRUCCIONES:
- Siempre respondes SOLO en JSON.
- "reply" debe contener 1–2 frases amables.
- Si el cliente dice un producto sin cantidad → PREGUNTA cantidad.
- Si dice un producto sin sabor → PREGUNTA sabor.
- Si dice un producto sin porción → PREGUNTA porción.
- Si el producto NO existe → informa y muestra opciones correctas.
- Si el cliente agrega productos en cualquier momento → acéptalos.
- Si el cliente ya confirmó y agrega algo → vuelve a pedir confirmación.
- Resumen estilo supermercado.
- ESTADOS válidos: inicio, preguntar_comuna, productos, datos_cliente, confirmacion, finalizado.

EL JSON DE RESPUESTA DEBE SER:
{
  "reply": "...",
  "state": "...",
  "data": {
    "comuna": "...",
    "productos": [...],
    "datos_cliente": {...},
    "pedido_completo": true|false,
    "confirmado": true|false,
    "horario_entrega": "...",
    "fecha_entrega": "YYYY-MM-DD"
  }
}`;

  const messages = [
    { role: "system", content: systemMessage },
    ...session.history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: "user",
      content:
        `Mensaje del cliente: "${userMessage}"\n\nContexto actual:\n` +
        JSON.stringify(contextoJSON),
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.15,
  });

  const raw = completion.choices[0]?.message?.content || "";
  console.log("🤖 [IA RAW]:", raw);

  return raw;
}

// ============================================================================
// PROCESADOR DE RESPUESTA IA → ACTUALIZA LA SESIÓN
// ============================================================================

async function procesarRespuestaIA(session, ai) {
  console.log("🧩 Procesando JSON IA…");

  // Estado
  if (ai.state) session.state = ai.state;

  // Comuna
  if (ai.data?.comuna) session.comuna = ai.data.comuna;

  // Productos (merge avanzado)
  if (Array.isArray(ai.data?.productos)) {
    const normal = normalizarProductos(ai.data.productos);
    const merged = mergeProductos(normal);
    session.cart = merged;
    console.log("🛒 Carrito actualizado:", merged);
  }

  // Datos cliente
  if (ai.data?.datos_cliente) {
    session.customer = {
      ...session.customer,
      ...ai.data.datos_cliente,
    };
    console.log("👤 Datos cliente:", session.customer);
  }

  // Fecha entrega
  if (ai.data?.fecha_entrega) {
    session.delivery.fecha_entrega = ai.data.fecha_entrega;
  } else {
    session.delivery.fecha_entrega = calcularFechaEntregaCorregida();
  }

  // Horario entrega
  if (ai.data?.horario_entrega) {
    session.delivery.horario_aprox = ai.data.horario_entrega;
  }

  return {
    pedido_completo: !!ai.data?.pedido_completo,
    confirmado: !!ai.data?.confirmado,
  };
}
// ============================================================================
// BLOQUE 3 / 3 — Guardado Supabase + Webhook WhatsAuto + Servidor
// ============================================================================

// Guardar cliente
async function upsertClienteFromSession(session) {
  console.log("💾 Guardando cliente…");

  const { phone, customer, comuna } = session;

  const { error } = await supabase.from("clientes").upsert(
    {
      telefono: phone,
      nombre: customer.nombre || null,
      direccion: customer.direccion || null,
      comuna: comuna || null,
      telefono_alt: customer.telefono_alt || null,
    },
    { onConflict: "telefono" }
  );

  if (error) console.error("❌ Error guardando cliente:", error);
  else console.log("✅ Cliente guardado:", phone);
}

// Guardar pedido completo
async function guardarPedidoCompleto(session) {
  console.log("💾 Guardando pedido completo…");

  const fechaEntrega = session.delivery.fecha_entrega || calcularFechaEntregaCorregida();

  const { data: pedido, error } = await supabase
    .from("pedidos")
    .insert({
      cliente_telefono: session.phone,
      comuna: session.comuna,
      fecha_entrega: fechaEntrega,
      horario_aprox: session.delivery.horario_aprox,
      resumen_texto: JSON.stringify(session.cart),
      estado: "pendiente",
    })
    .select()
    .single();

  if (error) {
    console.error("❌ Error insertando pedido:", error);
    return;
  }

  console.log("🧾 Pedido creado:", pedido.id);

  // Guardar detalle
  const detalles = session.cart.map((p) => ({
    pedido_id: pedido.id,
    descripcion: `${p.producto} ${p.sabor || ""} ${p.porcion ? "(" + p.porcion + ")" : ""}`,
    cantidad: p.cantidad,
    categoria: "producto",
  }));

  const { error: err2 } = await supabase.from("pedidos_detalle").insert(detalles);

  if (err2) console.error("❌ Error detalle:", err2);
  else console.log("📦 Detalle guardado");
}

// ============================================================================
// WEBHOOK WHATAUTO
// ============================================================================

app.post("/whatsapp", async (req, res) => {
  console.log("📥 BODY:", req.body);

  const { phone, message } = req.body || {};
  if (!phone || !message) {
    return res.json({
      reply: "No pude leer tu mensaje. ¿Puedes enviarlo nuevamente? 😊",
    });
  }

  const session = getSession(phone);

  // Buscar cliente la primera vez
  if (!session.checkedClient) {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("telefono", phone)
      .maybeSingle();

    if (data) {
      session.knownClient = true;
      session.customer.nombre = data.nombre;
      session.customer.direccion = data.direccion;
      session.customer.telefono_alt = data.telefono_alt;
      session.comuna = data.comuna;
      console.log("🟢 Cliente conocido:", phone);
    } else {
      console.log("🟡 Cliente nuevo:", phone);
    }

    session.checkedClient = true;
  }

  // Guardar historial
  pushHistory(session, "user", message);

  // IA
  let aiRaw;
  try {
    aiRaw = await askLunaAI({ session, userMessage: message });
  } catch (err) {
    console.error("❌ Error IA:", err);
    return res.json({ reply: "Error temporal, intenta nuevamente 🙏" });
  }

  let ai;
  try {
    ai = JSON.parse(aiRaw);
  } catch (err) {
    console.error("⚠ JSON inválido de IA.");
    return res.json({
      reply: "No entendí tu mensaje, ¿podrías repetirlo? 😊",
    });
  }

  const reply = ai.reply || "Estoy procesando tu pedido…";

  // Actualizar sesión
  const resultado = await procesarRespuestaIA(session, ai);

  // Si confirmó
  if (resultado.confirmado && !session.orderSaved) {
    await upsertClienteFromSession(session);
    await guardarPedidoCompleto(session);

    session.orderSaved = true;
    session.state = "finalizado";
  }

  pushHistory(session, "assistant", reply);

  return res.json({ reply });
});

// ============================================================================
// SERVIDOR
// ============================================================================

app.get("/", (req, res) => {
  res.send("Luna Bot funcionando correctamente ✅");
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
});
