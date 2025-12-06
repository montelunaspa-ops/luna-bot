/**************************************************************************
 *  LUNA BOT – ARCHIVO ÚNICO index.js
 *  Todo integrado: flujo, reglas, GPT, utils, DB y servidor Express.
 **************************************************************************/

require("dotenv").config();
const express = require("express");
const app = express();
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/********************************************
 * 🔵 CONFIGURACIÓN OPENAI Y SUPABASE
 ********************************************/
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/********************************************
 * 🔵 REGLAS Y CATÁLOGO (ANTES rules.js)
 ********************************************/
const RULES = {
  catalogo: `
📦 *CATÁLOGO DELICIAS MONTE LUNA*

🍰 *QUEQUES PERUANOS* — $8.500  
Sabores: Chocolate, Marmoleado, Piña, Vainilla, Naranja, Maracuyá  
Porciones: 14, 16 o sin cortar  
Tamaño: 28 cm x 10 cm

🍪 *GALLETAS Y DELICIAS* — Bandejas de 20 unidades — $4.000  
Variedades: Rellena de Manjar, Alemana, Giro Coco, Almejitas, Lengua de Gato,
Cocadas de Horno, Alfajorcito, Cachitos

🧁 *MUFFINS*
• Chips (6 unidades): $3.500  
• Premium surtido (6 unidades): $5.000  
Sabores: Chocolate, Red Velvet, Arándano, Coco y Chips

🤩 *DELICIAS PREMIUM*
• Alfajores de Maicena Premium (12 unidades, 8–9 cm): $6.000  
• Cachitos Manjar Premium (10 unidades): $6.000

🍞 *QUEQUE ARTESANAL RECTANGULAR*
• Sabores: Vainilla Chips, Manzana, Arándanos  
• Tamaño: 20 cm  
• Precio: $3.000  
• Oferta: 4 unidades por $10.000
`,

  comunasCobertura: [
    "Cerro Navia","Cerrillos","Conchalí","Estación Central","Independencia",
    "Lo Prado","Lo Espejo","Maipú","Pedro Aguirre Cerda","Pudahuel",
    "Quinta Normal","Recoleta","Renca","Santiago Centro","San Miguel","San Joaquín"
  ],

  horarios: {
    "Cerro Navia": "12:00 - 15:00",
    "Cerrillos": "12:00 - 15:00",
    "Conchalí": "12:00 - 15:00",
    "Estación Central": "12:00 - 15:00",
    "Independencia": "12:00 - 15:00",
    "Lo Prado": "12:00 - 15:00",
    "Lo Espejo": "12:00 - 15:00",
    "Maipú": "12:00 - 15:00",
    "Pedro Aguirre Cerda": "12:00 - 15:00",
    "Pudahuel": "12:00 - 15:00",
    "Quinta Normal": "12:00 - 15:00",
    "Recoleta": "12:00 - 15:00",
    "Renca": "12:00 - 15:00",
    "Santiago Centro": "12:00 - 15:00",
    "San Miguel": "12:00 - 15:00",
    "San Joaquín": "12:00 - 15:00"
  },

  bienvenida: "¡Hola! Soy Luna, tu asistente virtual de *Delicias Monte Luna* 🌙✨"
};

/********************************************
 * 🔵 UTILS (ANTES utils.js)
 ********************************************/
function normalizarTelefono(t) {
  return t.replace(/\s+/g, "").replace(/[^0-9+]/g, "");
}

function comunaValida(c) {
  if (!c) return null;
  c = c.trim().toLowerCase();

  const encontrada = RULES.comunasCobertura.find(
    x => x.toLowerCase() === c
  );
  return encontrada || null;
}

/********************************************
 * 🔵 GPT (ANTES gpt.js)
 ********************************************/
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres un modelo que analiza intención. Debes devolver JSON válido.

Intenciones posibles:
- saludo
- pregunta
- comuna
- pedido
- otro

Emociones:
- feliz
- neutro
- molesto

Detecta comuna SOLO si es de Chile.

Si detectas un producto, responde:
"pedido": "producto"

JSON final:
{
 "intencion":"",
 "texto_normalizado":"",
 "emocion":"",
 "comuna":"",
 "pedido":""
}

Mensaje: "${mensaje}"
`;

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  try {
    return JSON.parse(r.choices[0].message.content);
  } catch {
    return { intencion: "otro", texto_normalizado: mensaje, emocion: "neutro" };
  }
}

async function responderConocimiento(pregunta) {
  const prompt = `
Responde SOLO usando este catálogo:

${RULES.catalogo}

Pregunta: "${pregunta}"
`;
  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return r.choices[0].message.content;
}

async function validarComunaChile(texto) {
  const prompt = `
Detecta si esto es una comuna chilena. 

Texto: "${texto}"

Responde SOLO:
- nombre de comuna
- o "NO"
`;

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return r.choices[0].message.content.trim();
}

function emojiEmocion(e) {
  if (e === "feliz") return "😊";
  if (e === "molesto") return "😥";
  return "🙂";
}

/********************************************
 * 🔵 DB (ANTES dbSave.js)
 ********************************************/
async function guardarHistorial(telefono, mensaje, tipo) {
  await supabase.from("historial").insert({
    telefono,
    mensaje,
    tipo
  });
}

async function guardarPedidoTemporal(telefono, pedido) {
  await supabase.from("pedidos_temporales")
    .upsert({ telefono, pedido }, { onConflict: "telefono" });
}

async function guardarPedidoCompleto(state) {
  await supabase.from("pedidos").insert({
    telefono: state.phone,
    pedido: state.pedido,
    comuna: state.comuna,
    nombre: state.datos.nombre,
    direccion: state.datos.direccion,
    telefono2: state.datos.telefono2,
    fecha_entrega: state.fechaEntrega,
    horario: state.horarioEntrega
  });
}

/********************************************
 * 🔵 FLUJO (ANTES flow.js)
 ********************************************/
function crearEstado(phone) {
  return {
    phone,
    step: "inicio",
    entrega: null,
    comuna: null,
    pedido: [],
    datos: { nombre: "", direccion: "", telefono2: "" },
    horarioEntrega: "",
    fechaEntrega: ""
  };
}

function calcularFechaEntrega() {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  return manana.toISOString().split("T")[0];
}

async function procesarPaso(state, msg) {
  const info = await interpretarMensaje(msg);
  const emo = emojiEmocion(info.emocion);
  const texto = info.texto_normalizado || msg;

  console.log("➡ INTENCIÓN DETECTADA:", info);

  /******** SALUDO ********/
  if (info.intencion === "saludo" && state.step === "inicio") {
    state.step = "solicitar_comuna";
    return `${emo} ${RULES.bienvenida}\n\n${RULES.catalogo}\n¿En qué comuna será el despacho?`;
  }

  /******** COMUNA ********/
  if (state.step === "solicitar_comuna") {
    let c = comunaValida(texto);

    if (!c) {
      const detectada = await validarComunaChile(texto);

      if (detectada === "NO") {
        return `${emo} No logré reconocer esa comuna 😅. Ingresa nuevamente la comuna.`;
      }

      if (!RULES.comunasCobertura.includes(detectada)) {
        state.entrega = "retiro";
        state.comuna = detectada;
        state.step = "tomar_pedido";
        return `${emo} No hacemos despacho en *${detectada}* 😔\nPuedes retirar en *Calle Chacabuco 1120, Santiago Centro*.\n¿Qué deseas pedir?`;
      }

      c = detectada;
    }

    state.entrega = "domicilio";
    state.comuna = c;
    state.horarioEntrega = RULES.horarios[c];
    state.step = "tomar_pedido";

    return `${emo} Perfecto, hacemos despacho en *${c}*.\nHorario aproximado: *${state.horarioEntrega}*\n¿Qué deseas pedir?`;
  }

  /******** PEDIDO ********/
  if (state.step === "tomar_pedido") {
    const low = texto.toLowerCase();

    if (["nada más", "nada mas", "eso es todo"].some(x => low.includes(x))) {
      if (state.pedido.length === 0) {
        return `${emo} No tengo productos anotados 😅\n¿Qué deseas pedir?`;
      }
      state.step = "solicitar_nombre";
      return `${emo} Perfecto 😊 ¿Cuál es tu nombre y apellido?`;
    }

    if (info.pedido) state.pedido.push(info.pedido);
    else state.pedido.push(texto);

    await guardarPedidoTemporal(state.phone, state.pedido);

    return `${emo} Anotado 😊 ¿Algo más? Si no, escribe *nada más*.`;
  }

  /******** NOMBRE ********/
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = msg;
    state.step = "solicitar_direccion";
    return `${emo} ¿Cuál es la dirección exacta?`;
  }

  /******** DIRECCIÓN ********/
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = msg;
    state.step = "solicitar_telefono2";
    return `${emo} ¿Teléfono adicional? Si no, escribe *no*.`;
  }

  /******** TELÉFONO 2 ********/
  if (state.step === "solicitar_telefono2") {
    state.datos.telefono2 = msg.toLowerCase() === "no" ? "" : msg;

    state.fechaEntrega = calcularFechaEntrega();
    state.step = "confirmar";

    return (
      `${emo} Resumen del pedido 📦\n` +
      state.pedido.map(p => "- " + p).join("\n") +
      `\n\nCliente: ${state.datos.nombre}\nDirección: ${state.datos.direccion}\nTeléfonos: ${state.phone}${state.datos.telefono2 ? "/" + state.datos.telefono2 : ""}\nComuna: ${state.comuna}\n\n` +
      `Entrega: ${state.entrega === "domicilio"
        ? `Despacho ${state.fechaEntrega} entre ${state.horarioEntrega}`
        : `Retiro ${state.fechaEntrega} en Calle Chacabuco 1120`
      }\n\n` +
      `¿Confirmas? Responde *sí*.`
    );
  }

  /******** CONFIRMACIÓN ********/
  if (state.step === "confirmar") {
    if (texto.toLowerCase().startsWith("si")) {
      await guardarPedidoCompleto(state);
      state.step = "finalizado";
      return `${emo} ¡Pedido confirmado! Gracias por preferir Delicias Monte Luna 🌙✨`;
    }
    return `${emo} Para confirmar escribe *sí*.`;
  }

  return `${emo} No entendí 😅 ¿Puedes repetirlo?`;
}

/********************************************
 * 🔵 SERVIDOR EXPRESS
 ********************************************/
const sesiones = {};

app.post("/whatsapp", async (req, res) => {
  try {
    const body = req.body;
    console.log("📩 BODY RECIBIDO:", body);

    const phone = normalizarTelefono(body.phone || "");
    const message = body.message || "";

    if (!phone) return res.json({ reply: "Error con número de teléfono" });

    console.log("📩 MENSAJE:", { phone, message });

    if (!sesiones[phone]) sesiones[phone] = crearEstado(phone);

    await guardarHistorial(phone, message, "cliente");

    const respuesta = await procesarPaso(sesiones[phone], message);

    await guardarHistorial(phone, respuesta, "bot");

    return res.json({ reply: respuesta });

  } catch (e) {
    console.log("❌ ERROR GENERAL:", e);
    return res.json({ reply: "Hubo un error procesando tu mensaje." });
  }
});

/********************************************
 * 🔵 INICIO DEL SERVIDOR
 ********************************************/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`)
);
