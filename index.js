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
// 5. REGLAS DE FLUJO (TAL CUAL)
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
     - Ofrecer entrega en el domicilio Calle Chacabuco 1120, Santiago Centro.
     - Si la persona acepta, se sigue al paso 4.
     - Si no acepta, se despide amablemente.
4. Preguntar por los productos, sabores, cantidades y porciones que el cliente desea, teniendo en cuenta SOLO los productos del catálogo.
5. Luego de identificar que el cliente pidió todo lo que desea:
   - Preguntar los datos para el despacho UNO POR UNO.
6. Enviar resumen y pedir confirmación.
7. Guardar pedido y cerrar con un check verde (✅).
`;

// =====================================================
// 6. FORMATO JSON OBLIGATORIO (PARCHE CRÍTICO)
// =====================================================

const JSON_FORMAT_RULES = `
IMPORTANTE: NO debes responder usando "respuesta", "accion", "catalogo", "pregunta_comuna" u otros campos NO permitidos.

TU ÚNICO FORMATO PERMITIDO ES ESTE:

{
  "reply": "texto corto y amable",
  "state": "inicio | preguntar_comuna | pedidos | datos_despacho | confirmacion | finalizado",
  "data": {
    "comuna": "nombre o null",
    "productos": [
      {
        "descripcion": "texto libre",
        "cantidad": 1,
        "categoria": "queques peruanos | galletas | muffins | delicias premium | queque artesanal rectangular | otro"
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

SIEMPRE debes responder EXACTAMENTE así.
ESTÁ TOTALMENTE PROHIBIDO:
- Crear nuevas claves
- Cambiar nombres
- Enviar texto fuera del JSON
- Enviar catálogo estructurado
`;

// =====================================================
// 7. FECHAS
// =====================================================

function normalizarFecha(fechaIA) {
  if (!fechaIA) return null;

  const f = String(fechaIA).toLowerCase().trim();

  if (f.includes("mañana")) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  }

  if (f.includes("hoy")) {
    return new Date().toISOString().split("T")[0];
  }

  const dias = {
    lunes: 1,
    martes: 2,
    miercoles: 3,
    miércoles: 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    sábado: 6,
    domingo: 0,
  };

  for (const dia in dias) {
    if (f.includes(dia)) {
      const hoy = new Date();
      const target = new Date();
      const diff = (dias[dia] + 7 - hoy.getDay()) % 7;
      target.setDate(hoy.getDate() + diff);
      return target.toISOString().split("T")[0];
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;

  return calcularFechaEntrega();
}

function calcularFechaEntrega() {
  const hoy = new Date();
  const entrega = new Date(hoy);
  entrega.setDate(entrega.getDate() + 1);

  if (entrega.getDay() === 0) entrega.setDate(entrega.getDate() + 1);

  return entrega.toISOString().split("T")[0];
}

// =====================================================
// 8. IA (CON PARCHE DE FORMATO JSON)
// =====================================================

async function askLunaAI({ session, userMessage }) {
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
Eres Luna, asistente de Delicias Monte Luna.
Debes seguir estrictamente las reglas del flujo y catálogo.

${FLOW_RULES_TEXT}

${RULES_TEXT}

${JSON_FORMAT_RULES}
`;

  const messages = [
    { role: "system", content: systemMessage },
    ...session.history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: "user",
      content: `Mensaje del cliente: "${userMessage}". Contexto: ${JSON.stringify(
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
// 9. GUARDADO SUPABASE
// =====================================================

async function upsertClienteFromSession(session) {
  const { phone, customer, comuna } = session;

  await supabase.from("clientes").upsert(
    {
      telefono: phone,
      nombre: customer.nombre || null,
      direccion: customer.direccion || null,
      comuna: comuna || null,
      telefono_alt: customer.telefono_alt || null,
    },
    { onConflict: "telefono" }
  );
}

async function guardarPedidoCompleto(session, resumenTexto, dataAI) {
  const fecha_entrega =
    normalizarFecha(dataAI?.fecha_entrega) ||
    session.delivery.fecha_entrega ||
    calcularFechaEntrega();

  const horario_entrega =
    dataAI?.horario_entrega || session.delivery.horario_aprox || null;

  const { data: pedido, error: errorPedido } = await supabase
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

  if (!errorPedido && Array.isArray(session.cart)) {
    const detalles = session.cart.map((item) => ({
      pedido_id: pedido.id,
      descripcion: item.descripcion || "",
      cantidad: item.cantidad || 1,
      categoria: item.categoria || null,
    }));

    await supabase.from("pedidos_detalle").insert(detalles);
  }
}

// =====================================================
// 10. ENDPOINT WHATSAUTO
// =====================================================

app.post("/whatsapp", async (req, res) => {
  console.log("📥 BODY:", req.body);

  const { phone, message } = req.body;
  if (!phone || !message)
    return res.json({ reply: "Hola, ¿puedes repetir tu mensaje? 😊" });

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
    }

    session.checkedClient = true;
  }

  pushHistory(session, "user", message);

  let aiRaw;
  try {
    aiRaw = await askLunaAI({ session, userMessage: message });
    console.log("🤖 RAW IA:", aiRaw);
  } catch {
    return res.json({
      reply: "Lo siento, tuve un problema. ¿Puedes repetir tu mensaje? 🙏",
    });
  }

  let ai;
  try {
    ai = JSON.parse(aiRaw);
  } catch {
    return res.json({ reply: aiRaw });
  }

  const replyText = ai.reply || "Procesando tu pedido ✨";
  const data = ai.data || {};

  session.state = ai.state || session.state;

  if (data.comuna) session.comuna = data.comuna;
  if (data.productos) session.cart = data.productos;
  if (data.datos_cliente)
    session.customer = { ...session.customer, ...data.datos_cliente };
  if (data.fecha_entrega) session.delivery.fecha_entrega = data.fecha_entrega;
  if (data.horario_entrega)
    session.delivery.horario_aprox = data.horario_entrega;

  if (data.confirmado && !session.orderSaved) {
    await upsertClienteFromSession(session);

    const resumenTexto =
      `Pedido para ${session.phone}: ` +
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
// 11. SERVIDOR HTTP
// =======================
app.get("/", (req, res) =>
  res.send("Luna Bot - Delicias Monte Luna está funcionando ✅")
);

app.listen(PORT, () =>
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`)
);
