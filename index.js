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
   - Preguntar los datos para el despacho UNO POR UNO:
     a) Nombre y apellido del cliente.
     b) Dirección.
     c) Teléfono adicional (si no se tiene, se usa el mismo de WhatsApp).
6. Al identificar que el pedido está completo y verificar que los datos de despacho están correctos:
   - Enviar al cliente un resumen de lo que pidió.
   - Incluir datos de despacho, fecha de entrega y hora aproximada.
   - Pedir que confirme.
7. Al realizar la confirmación:
   - Guardar toda la información en las tablas correspondientes.
   - Enviar un mensaje al cliente indicando que el pedido quedó agendado.
   - Al final de la conversación se envía un emoji de check verde (✅).

REGLAS ADICIONALES PARA LA IA:
- Responde SIEMPRE en español, con tono amable y cercano.
- Respuestas CORTAS y CONCISAS (máximo 2 frases).
- Puedes responder preguntas libres del cliente en cualquier momento, pero luego vuelve a encaminar la conversación hacia el flujo de venta.
- NO inventes productos, precios, comunas ni reglas que no estén en el texto de catálogo y reglas.
- Si te preguntan algo fuera del contexto de catálogo, comunas o despachos, responde brevemente que solo puedes ayudar con información de pedidos, catálogo y despachos.
- Nunca ofrezcas métodos de pago distintos a efectivo o débito.
- Siempre que sea el primer mensaje del cliente en la conversación, DA LA BIENVENIDA.
`;

// =====================================================
// 6. HELPERS PARA FECHA DE ENTREGA Y TABLAS
// =====================================================

function calcularFechaEntrega() {
  const hoy = new Date();
  // Convertir a zona horaria Chile/Colombia según servidor (simplificado)
  let diaSemana = hoy.getDay(); // 0 domingo, 6 sábado

  // Regla: entregas al día siguiente, excepto domingos (los pedidos de sábado y domingo se entregan lunes)
  let entrega = new Date(hoy);
  entrega.setDate(entrega.getDate() + 1);

  const mañanaDia = entrega.getDay();

  // Si día de entrega cae domingo, mover a lunes
  if (mañanaDia === 0) {
    entrega.setDate(entrega.getDate() + 1);
  }

  return entrega.toISOString().split("T")[0]; // YYYY-MM-DD
}

// NOTA IMPORTANTE: Debes crear las siguientes tablas en Supabase:
//
// Tabla: clientes
// - id (uuid) PK default uuid_generate_v4()
// - telefono (text) UNIQUE
// - nombre (text)
// - direccion (text)
// - comuna (text)
// - telefono_alt (text)
//
// Tabla: pedidos
// - id (uuid) PK default uuid_generate_v4()
// - cliente_telefono (text) (FK lógica a clientes.telefono)
// - comuna (text)
// - fecha_entrega (date)
// - horario_aprox (text)
// - resumen_texto (text)
// - total_estimado (numeric, nullable)
// - estado (text) (ej: 'pendiente')
//
// Tabla: pedidos_detalle
// - id (uuid) PK
// - pedido_id (uuid) FK a pedidos.id
// - descripcion (text)
// - cantidad (integer)
// - categoria (text)
// - precio_unitario (numeric, nullable)

// =====================================================
// 7. LLAMADO A GPT-4O-MINI CON SALIDA ESTRUCTURADA
// =====================================================

async function askLunaAI({ session, userMessage }) {
  const knownClientFlag = session.knownClient ? "sí" : "no";

  // Contexto que verá la IA
  const contextoJSON = {
    estado_sesion: session.state,
    telefono: session.phone,
    cliente_conocido: knownClientFlag,
    comuna_actual: session.comuna,
    carrito_actual: session.cart,
    datos_cliente: session.customer,
    entrega: session.delivery,
  };

  const systemMessage = `
Eres Luna, asistente virtual de Delicias Monte Luna. 
Eres un BOT de ventas por WhatsApp que SIGUE ESTRICTAMENTE las reglas del flujo y el texto de catálogo proporcionado.

${FLOW_RULES_TEXT}

A continuación tienes el texto completo de catálogo, comunas y reglas. NO LO RESUMAS, NO LO MODIFIQUES, solo úsalo como referencia para responder:

${RULES_TEXT}

INSTRUCCIONES DE FORMATO DE RESPUESTA:
Debes responder SIEMPRE en formato JSON VÁLIDO, sin texto adicional, con la siguiente forma:

{
  "reply": "texto corto de respuesta al cliente",
  "state": "inicio | preguntar_comuna | pedidos | datos_despacho | confirmacion | finalizado",
  "data": {
    "comuna": "nombre de la comuna o null",
    "productos": [
      {
        "descripcion": "texto libre del producto y sabor",
        "cantidad": 1,
        "categoria": "queques peruanos | galletas | muffins | delicias premium | queque artesanal rectangular | otro"
      }
    ],
    "datos_cliente": {
      "nombre": "Nombre y apellido o null",
      "direccion": "Dirección completa o null",
      "telefono_alt": "Teléfono alternativo o null"
    },
    "pedido_completo": true o false,
    "confirmado": true o false,
    "horario_entrega": "franja de horario aproximado o null",
    "fecha_entrega": "YYYY-MM-DD o null"
  }
}

REGLAS DEL JSON:
- "reply" debe ser una o dos frases, amables y claras.
- Si no estás seguro de algún campo, usa null o deja valores vacíos.
- Si el cliente confirma el pedido, "confirmado": true.
- Si crees que ya pidió todo, "pedido_completo": true y pasa a estado "confirmacion".
- Si ya se confirmó todo, usa estado "finalizado".
- Usa siempre comillas dobles en claves y textos (JSON válido).
`;

  const messages = [
    { role: "system", content: systemMessage },
    // Historial resumido
    ...session.history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    {
      role: "user",
      content: `Mensaje del cliente: "${userMessage}".\n\nContexto de la sesión:\n${JSON.stringify(
        contextoJSON
      )}`,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content || "";
  return content;
}

// =====================================================
// 8. GUARDAR CLIENTE Y PEDIDO EN SUPABASE
// =====================================================

async function upsertClienteFromSession(session) {
  const { phone, customer, comuna } = session;
  if (!phone) return;

  const { nombre, direccion, telefono_alt } = customer || {};

  const { data, error } = await supabase
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
    )
    .select()
    .single();

  if (error) {
    console.error("❌ Error upsert cliente:", error);
  } else {
    console.log("✅ Cliente registrado/actualizado:", data?.telefono);
  }
}

async function guardarPedidoCompleto(session, resumenTexto, dataAI) {
  try {
    const fecha_entrega =
      dataAI?.fecha_entrega || session.delivery.fecha_entrega || calcularFechaEntrega();
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
        total_estimado: null,
        estado: "pendiente",
      })
      .select()
      .single();

    if (errorPedido) {
      console.error("❌ Error insert pedido:", errorPedido);
      return;
    }

    console.log("✅ Pedido creado:", pedido.id);

    if (Array.isArray(session.cart)) {
      const detalles = session.cart.map((item) => ({
        pedido_id: pedido.id,
        descripcion: item.descripcion || "",
        cantidad: item.cantidad || 1,
        categoria: item.categoria || null,
        precio_unitario: null,
      }));

      if (detalles.length > 0) {
        const { error: errorDetalle } = await supabase
          .from("pedidos_detalle")
          .insert(detalles);

        if (errorDetalle) {
          console.error("❌ Error insert pedidos_detalle:", errorDetalle);
        } else {
          console.log("✅ Detalle de pedido guardado.");
        }
      }
    }
  } catch (err) {
    console.error("❌ Error inesperado guardando pedido:", err);
  }
}

// =====================================================
// 9. ENDPOINT PRINCIPAL PARA WHATSAUTO
// =====================================================

app.post("/whatsapp", async (req, res) => {
  console.log("📩 [WEBHOOK] Payload recibido:", req.body);

  // WhatsAuto normalmente envía:
  // {
  //   "app": "WhatsAuto",
  //   "sender": "Nombre",
  //   "phone": "+56912345678",
  //   "message": "Hola",
  //   "type": "text",
  //   "mediaUrl": null
  // }

  const { phone, message } = req.body || {};

  if (!phone || !message) {
    console.warn("⚠️ Payload incompleto, faltan phone o message");
    return res.json({
      reply:
        "Hola, soy Luna de Delicias Monte Luna. No pude leer bien tu mensaje, ¿puedes escribirlo de nuevo por favor? 😊",
    });
  }

  const session = getSession(phone);

  // 1) Cargar datos del cliente la primera vez (solo una vez por sesión)
  if (!session.checkedClient) {
    try {
      const { data: cliente, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("telefono", phone)
        .maybeSingle();

      if (error) {
        console.error("❌ Error buscando cliente:", error);
      }

      if (cliente) {
        session.knownClient = true;
        session.customer.nombre = cliente.nombre;
        session.customer.direccion = cliente.direccion;
        session.customer.telefono_alt = cliente.telefono_alt;
        session.comuna = cliente.comuna;
        console.log("✅ Cliente encontrado en BD:", phone);
      } else {
        console.log("ℹ️ Cliente no existe aún en BD:", phone);
      }

      session.checkedClient = true;
    } catch (err) {
      console.error("❌ Error inesperado consultando cliente:", err);
    }
  }

  pushHistory(session, "user", message);

  let aiRawResponse;
  try {
    aiRawResponse = await askLunaAI({ session, userMessage: message });
    console.log("🤖 Respuesta cruda de IA:", aiRawResponse);
  } catch (err) {
    console.error("❌ Error llamando a OpenAI:", err);
    return res.json({
      reply:
        "Lo siento, estoy con un pequeño problema técnico. ¿Podrías intentar de nuevo en un momento por favor? 🙏",
    });
  }

  let ai;
  try {
    ai = JSON.parse(aiRawResponse);
  } catch (err) {
    console.error("⚠️ No se pudo parsear JSON de la IA, se responde texto directo.");
    const fallbackReply =
      aiRawResponse ||
      "Disculpa, tuve un problema procesando tu mensaje. ¿Puedes repetirlo de forma más simple, por favor? 😊";
    pushHistory(session, "assistant", fallbackReply);
    return res.json({ reply: fallbackReply });
  }

  const replyText = ai.reply || "Listo, Luna te está ayudando con tu pedido. 😊";
  const nextState = ai.state || session.state;
  const data = ai.data || {};

  // Actualizar sesión con la info entregada por la IA
  session.state = nextState;

  if (data.comuna) {
    session.comuna = data.comuna;
  }

  if (Array.isArray(data.productos)) {
    // Mantenemos un carrito simple (podrías mejorar lógica de merge si quieres)
    session.cart = data.productos;
  }

  if (data.datos_cliente) {
    session.customer = {
      ...session.customer,
      ...data.datos_cliente,
    };
  }

  if (data.fecha_entrega) {
    session.delivery.fecha_entrega = data.fecha_entrega;
  }

  if (data.horario_entrega) {
    session.delivery.horario_aprox = data.horario_entrega;
  }

  const pedidoCompleto = !!data.pedido_completo;
  const confirmado = !!data.confirmado;

  // Si el pedido está confirmado y aún no se ha guardado -> guardar en Supabase
  if (confirmado && !session.orderSaved) {
    // Registrar/actualizar cliente
    await upsertClienteFromSession(session);

    // Crear resumen textual (puede ser el mismo reply o un texto corto)
    const resumenTexto =
      `Resumen de pedido para ${session.phone}: ` +
      (session.cart || [])
        .map((p) => `${p.cantidad || 1} x ${p.descripcion || "producto"}`)
        .join(", ");

    await guardarPedidoCompleto(session, resumenTexto, data);
    session.orderSaved = true;
    session.state = "finalizado";
  }

  pushHistory(session, "assistant", replyText);

  // RESPUESTA PARA WHATSAUTO
  // WhatsAuto espera algo como:
  // { "reply": "Texto que se enviará por WhatsApp" }
  return res.json({ reply: replyText });
});

// =======================
// 10. SERVIDOR HTTP
// =======================
app.get("/", (req, res) => {
  res.send("Luna Bot - Delicias Monte Luna está funcionando ✅");
});

app.listen(PORT, () => {
  console.log(`🚀 Luna Bot escuchando en el puerto ${PORT}`);
});
