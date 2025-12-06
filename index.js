/************************************************************
 * LUNA BOT — VERSIÓN FINAL CONSOLIDADA
 * Un solo archivo con TODO integrado:
 * - Flujo
 * - Interpretación IA (GPT-4o-mini)
 * - Pedidos + clientes + historial
 * - Validación inteligente de comunas
 * - Catálogo en formato tabulado perfecto
 ************************************************************/

require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "2mb" }));

/************************************************************
 * 🔵 CONFIGURACIÓN IA Y SUPABASE
 ************************************************************/
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

/************************************************************
 * 🔵 CATÁLOGO (formato tabulado y EXACTO)
 ************************************************************/
const CATALOGO = `
📦 *CATÁLOGO DELICIAS MONTE LUNA*

🍰 *QUEQUES PERUANOS* — $8.500  
Sabores disponibles: Chocolate, Marmoleado, Piña, Vainilla, Naranja, Maracuyá  
Porciones: 14, 16 o sin cortar  
Tamaño: 28 cm de diámetro, 10 cm de alto aprox.  

🍪 *GALLETAS Y DELICIAS* — $4.000  
Bandejas de 20 unidades  
Variedades:  
• Rellena de Manjar  
• Alemana  
• Giro Coco  
• Almejitas  
• Lengua de Gato  
• Cocadas de Horno  
• Alfajorcito  
• Cachitos  

🧁 *MUFFINS*  
• Chips (6 unidades): $3.500  
• Premium Surtido (6 unidades): $5.000  

🤩 *DELICIAS PREMIUM*  
• Alfajores de Maicena Premium (12 unidades): $6.000  
• Cachitos Manjar Premium (10 unidades): $6.000  

🍞 *QUEQUE ARTESANAL RECTANGULAR*  
• Sabores: Vainilla Chips, Manzana, Arándanos  
• Tamaño: 20 cm  
• Precio: $3.000  
• Oferta: 4 unidades por $10.000  
`;

const COMUNAS_COBERTURA = [
  "Cerro Navia", "Cerrillos", "Conchalí", "Estación Central", "Independencia",
  "Lo Prado", "Lo Espejo", "Maipú", "Pedro Aguirre Cerda", "Pudahuel",
  "Quinta Normal", "Recoleta", "Renca", "Santiago Centro", "San Miguel", "San Joaquín"
];

const HORARIOS = {
  "Cerro Navia": "13:00 - 16:00",
  "Cerrillos": "12:00 - 15:00",
  "Conchalí": "13:00 - 17:00",
  "Estación Central": "12:00 - 16:00",
  "Independencia": "13:00 - 17:00",
  "Lo Prado": "12:00 - 16:00",
  "Lo Espejo": "12:00 - 16:00",
  "Maipú": "13:00 - 17:00",
  "Pedro Aguirre Cerda": "12:00 - 15:00",
  "Pudahuel": "13:00 - 17:00",
  "Quinta Normal": "12:00 - 16:00",
  "Recoleta": "13:00 - 17:00",
  "Renca": "13:00 - 17:00",
  "Santiago Centro": "12:00 - 16:00",
  "San Miguel": "12:00 - 15:00",
  "San Joaquín": "12:00 - 15:00"
};

/************************************************************
 * 🔵 INTERPRETACIÓN CON GPT — INTENCIÓN + COMUNA + PEDIDO
 ************************************************************/
async function interpretarMensaje(msg) {
  const prompt = `
Eres un analizador experto de mensajes de WhatsApp.
Devuelve SIEMPRE JSON válido con esta estructura:

{
 "intencion": "saludo | pregunta | comuna | pedido | otro",
 "emocion": "feliz | neutro | molesto",
 "texto_normalizado": "",
 "comuna": "",
 "pedido": ""
}

- Detecta comunas de Chile aunque estén mal escritas.
- Detecta si el usuario está pidiendo un producto.
- Mantén texto_normalizado para comparar.

Mensaje del usuario: "${msg}"
`;

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  try {
    return JSON.parse(r.choices[0].message.content);
  } catch {
    return { intencion: "otro", texto_normalizado: msg, emocion: "neutro" };
  }
}

/************************************************************
 * 🔵 VALIDACIÓN INTELIGENTE DE COMUNA (GPT)
 ************************************************************/
async function validarComunaChile(texto) {
  const prompt = `
Del siguiente texto identifica si corresponde a una comuna REAL de Chile.
Responde SOLO el nombre en limpio o "NO".

Texto: "${texto}"
`;

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return r.choices[0].message.content.trim();
}

/************************************************************
 * 🔵 FLUJO COMPLETO EN MEMORIA
 ************************************************************/
const sesiones = {};

function nuevaSesion(phone) {
  return {
    phone,
    step: "inicio",
    comuna: null,
    pedido: [],
    datos: { nombre: "", direccion: "", telefono2: "" },
    entrega: "domicilio",
    horarioEntrega: "",
    fechaEntrega: ""
  };
}

/************************************************************
 * 🔵 GUARDAR HISTORIAL SUPABASE
 ************************************************************/
async function guardarHistorial(phone, mensaje, tipo) {
  await supabase.from("historial").insert({
    telefono: phone,
    mensaje,
    tipo
  });
}

/************************************************************
 * 🔵 GUARDAR PEDIDO TEMPORAL
 ************************************************************/
async function guardarPedidoTemporal(phone, pedido) {
  await supabase
    .from("pedidos_temporales")
    .upsert({ telefono: phone, pedido });
}

/************************************************************
 * 🔵 GUARDAR PEDIDO FINAL
 ************************************************************/
async function guardarPedidoCompleto(state) {
  await supabase.from("pedidos").insert({
    telefono: state.phone,
    pedido: state.pedido,
    nombre: state.datos.nombre,
    direccion: state.datos.direccion,
    telefono2: state.datos.telefono2,
    comuna: state.comuna,
    fecha_entrega: state.fechaEntrega,
    horario: state.horarioEntrega
  });
}

/************************************************************
 * 🔵 EMOCIÓN → EMOJI
 ************************************************************/
function emo(e) {
  if (e === "feliz") return "😊";
  if (e === "molesto") return "😥";
  return "🙂";
}

/************************************************************
 * 🔵 PROCESAR MENSAJE
 ************************************************************/
async function procesar(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  console.log("➡ INTENCIÓN:", info);

  const emoji = emo(info.emocion);
  const txt = info.texto_normalizado || mensaje;

  /***********************
   * SALUDO
   ***********************/
  if (info.intencion === "saludo" && state.step === "inicio") {
    state.step = "comuna";
    return `${emoji} ¡Hola! Soy Luna, asistente de *Delicias Monte Luna* 🌙✨  
${CATALOGO}
¿En qué comuna será el despacho?`;
  }

  /***********************
   * PREGUNTAS AI
   ***********************/
  if (info.intencion === "pregunta") {
    const prompt = `
Responde usando SOLO esta información:

${CATALOGO}

Pregunta del cliente: "${mensaje}"
`;
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    return `${emoji} ${r.choices[0].message.content}`;
  }

  /***********************
   * PASO 1 — COMUNA
   ***********************/
  if (state.step === "comuna") {
    let comuna = await validarComunaChile(txt);

    if (comuna === "NO") {
      return `${emoji} No logré reconocer esa comuna 😅\nIndícala nuevamente.`;
    }

    if (!COMUNAS_COBERTURA.includes(comuna)) {
      state.entrega = "retiro";
      state.comuna = comuna;
      state.step = "pedido";
      return `${emoji} No tenemos despacho en *${comuna}* 😔  
Puedes retirar en *Calle Chacabuco 1120, Santiago Centro*.  
¿Qué deseas pedir?`;
    }

    state.comuna = comuna;
    state.horarioEntrega = HORARIOS[comuna];
    state.entrega = "domicilio";
    state.step = "pedido";

    return `${emoji} Perfecto 😊 hacemos despacho en *${comuna}*.  
Horario estimado: *${state.horarioEntrega}*  
¿Qué deseas pedir?`;
  }

  /***********************
   * PASO 2 — PEDIDO
   ***********************/
  if (state.step === "pedido") {
    const lower = txt.toLowerCase();

    if (["nada más", "nada mas", "eso es todo", "listo"].includes(lower)) {
      if (state.pedido.length === 0) {
        return `${emoji} Aún no tengo productos anotados 😅\n¿Qué deseas pedir?`;
      }
      state.step = "nombre";
      return `${emoji} Perfecto 😊 ¿Cuál es tu nombre y apellido?`;
    }

    state.pedido.push(info.pedido || txt);
    await guardarPedidoTemporal(state.phone, state.pedido);

    return `${emoji} Anotado 😊\nCuando termines, escribe *nada más*.`;
  }

  /***********************
   * PASO 3 — NOMBRE
   ***********************/
  if (state.step === "nombre") {
    state.datos.nombre = mensaje;
    state.step = "direccion";
    return `${emoji} Gracias 😊 ¿Cuál es la dirección exacta?`;
  }

  /***********************
   * PASO 4 — DIRECCIÓN
   ***********************/
  if (state.step === "direccion") {
    state.datos.direccion = mensaje;
    state.step = "telefono2";
    return `${emoji} ¿Tienes teléfono adicional? Si no, escribe *no*.`;
  }

  /***********************
   * PASO 5 — TELÉFONO 2
   ***********************/
  if (state.step === "telefono2") {
    state.datos.telefono2 = mensaje.toLowerCase() === "no" ? "" : mensaje;

    const hoy = new Date();
    const entrega = new Date(hoy);
    entrega.setDate(hoy.getDate() + (hoy.getDay() === 6 ? 2 : hoy.getDay() === 0 ? 1 : 1));
    state.fechaEntrega = entrega.toISOString().split("T")[0];

    state.step = "confirmar";

    const resumen = `
Resumen del pedido 📦
${state.pedido.map(p => "- " + p).join("\n")}

Datos del cliente 🧾
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Teléfonos: ${state.phone}${state.datos.telefono2 ? " / " + state.datos.telefono2 : ""}
• Comuna: ${state.comuna}

Entrega: ${
      state.entrega === "domicilio"
        ? `Despacho el *${state.fechaEntrega}* entre *${state.horarioEntrega}*`
        : `Retiro el *${state.fechaEntrega}* en Calle Chacabuco 1120`
    }

¿Confirmas el pedido? Escribe *sí*.
`;

    return `${emoji} ${resumen}`;
  }

  /***********************
   * PASO 6 — CONFIRMAR
   ***********************/
  if (state.step === "confirmar") {
    const lower = txt.toLowerCase();

    if (lower.startsWith("si")) {
      await guardarPedidoCompleto(state);
      state.step = "finalizado";
      return `${emoji} ¡Tu pedido fue registrado con éxito! 🌙✨  
Gracias por preferir *Delicias Monte Luna*.`;
    }

    return `${emoji} Para confirmar escribe *sí*.`;
  }

  /***********************
   * FINALIZADO
   ***********************/
  if (state.step === "finalizado") {
    return `${emoji} Tu pedido ya fue confirmado 😊 Si deseas hacer otro, escribe *Hola*.`;
  }

  return `${emoji} No entendí 😅 ¿Puedes repetirlo?`;
}

/************************************************************
 * 🔵 WEBHOOK WHATSAPP
 ************************************************************/
app.post("/whatsapp", async (req, res) => {
  try {
    const body = req.body;
    console.log("📩 BODY RECIBIDO:", body);

    const phone = (body.phone || "").replace(/\s+/g, "");
    const message = body.message || "";

    if (!phone) return res.json({ reply: "Error: falta teléfono." });

    if (!sesiones[phone]) sesiones[phone] = nuevaSesion(phone);
    const state = sesiones[phone];

    await guardarHistorial(phone, message, "cliente");
    const respuesta = await procesar(state, message);
    await guardarHistorial(phone, respuesta, "bot");

    res.json({ reply: respuesta });

  } catch (e) {
    console.error("❌ ERROR /whatsapp:", e);
    res.json({ reply: "Hubo un error procesando tu mensaje 😥" });
  }
});

/************************************************************
 * 🔵 INICIAR SERVIDOR
 ************************************************************/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
});
