require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

const app = express();

// -----------------------------------------------------
// 🔵 CONFIGURACIÓN IA + SUPABASE
// -----------------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// -----------------------------------------------------
// 🔵 MIDDLEWARE PARA WhatsAuto
// -----------------------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "5mb" }));

// -----------------------------------------------------
// 🔵 SESIONES EN MEMORIA
// -----------------------------------------------------
const sesiones = {};

// -----------------------------------------------------
// 🔵 CATÁLOGO Y COMUNAS (SE QUEDAN AQUÍ PARA LA IA)
// -----------------------------------------------------
const CATALOGO = `
📦 *CATÁLOGO DELICIAS MONTE LUNA*

🍰 *QUEQUES PERUANOS* — $8.500  
Sabores disponibles: Chocolate, Marmoleado, Piña, Vainilla, Naranja, Maracuyá  
Porciones: 14, 16 o sin cortar  
Tamaño: 28 cm de diámetro, 10 cm de alto aprox.

🍪 *GALLETAS Y DELICIAS* — Bandejas de 20 unidades — $4.000  
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
• Muffin Chips (6 unidades): $3.500  
• Premium surtido (6 unidades): $5.000  
  Sabores: Chocolate, Red Velvet, Arándano, Coco, Chips  

🤩 *DELICIAS PREMIUM*  
• Alfajores Premium (12 unidades, 8–9 cm): $6.000  
• Cachitos Manjar Premium (10 unidades, 11–12 cm): $6.000  

🍞 *QUEQUE ARTESANAL RECTANGULAR*  
• Sabores: Vainilla Chips, Manzana, Arándanos  
• Tamaño: 20 cm  
• Precio: $3.000  
• Oferta: 4 unidades por $10.000  
`;

const COMUNAS = [
  "Cerro Navia",
  "Cerrillos",
  "Conchalí",
  "Estación Central",
  "Independencia",
  "Lo Prado",
  "Lo Espejo",
  "Maipú",
  "Pedro Aguirre Cerda",
  "Pudahuel",
  "Quinta Normal",
  "Recoleta",
  "Renca",
  "Santiago Centro",
  "San Miguel",
  "San Joaquín"
];

// -----------------------------------------------------
// 🔵 INTERPRETACIÓN DEL MENSAJE POR IA
// -----------------------------------------------------
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres un analizador de intención. Responde SOLO en JSON.

Intenciones posibles:
- saludo
- pregunta
- comuna
- pedido
- otro

Detecta emociones: feliz, neutro, molesto.

Detecta comuna solo si es real de Chile.

Ejemplo JSON:
{
  "intencion": "",
  "texto_normalizado": "",
  "emocion": "",
  "comuna": "",
  "pedido": ""
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

// -----------------------------------------------------
// 🔵 RESPUESTA EMOCIONAL
// -----------------------------------------------------
function emo(e) {
  if (e === "feliz") return "😊";
  if (e === "molesto") return "😥";
  return "🙂";
}

// -----------------------------------------------------
// 🔵 RESPONDER PREGUNTAS DEL CATÁLOGO
// -----------------------------------------------------
async function responderConocimiento(pregunta) {
  const prompt = `
Responde usando solo esta información:

${CATALOGO}

Si preguntan por algo que NO existe, indícalo.

Pregunta del cliente: "${pregunta}"
`;

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return r.choices[0].message.content.trim();
}

// -----------------------------------------------------
// 🔵 VALIDAR COMUNA POR IA
// -----------------------------------------------------
async function validarComunaChile(texto) {
  const prompt = `
¿"${texto}" es una comuna real de Chile?

Responde SOLO:
- El nombre exacto
- O "NO"
`;
  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return r.choices[0].message.content.trim();
}

// -----------------------------------------------------
// 🔵 FECHA DE ENTREGA
// -----------------------------------------------------
function fechaEntrega() {
  const h = new Date();
  const d = new Date(h);
  d.setDate(h.getDate() + 1);

  if (h.getDay() === 6) d.setDate(h.getDate() + 2);
  if (h.getDay() === 0) d.setDate(h.getDate() + 1);

  return d.toISOString().split("T")[0];
}

// -----------------------------------------------------
// 🔵 FLUJO PRINCIPAL
// -----------------------------------------------------
function nuevaSesion(phone) {
  return {
    phone,
    step: "inicio",
    comuna: null,
    pedido: [],
    datos: { nombre: "", direccion: "", telefono2: "" },
    entrega: "domicilio",
    horario: "",
    fecha: ""
  };
}

async function procesar(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  console.log("➡ INTENCIÓN:", info);

  const emoción = emo(info.emocion);
  const txt = info.texto_normalizado.toLowerCase();

  // ---------------------------
  // SALUDO → Bienvenida + catálogo
  // ---------------------------
  if (info.intencion === "saludo" && state.step === "inicio") {
    state.step = "comuna";
    return (
      `${emoción} ¡Hola! Soy Luna, tu asistente virtual 🌙✨\n\n` +
      `${CATALOGO}\n¿En qué comuna será el despacho?`
    );
  }

  // ---------------------------
  // PREGUNTA GENERAL
  // ---------------------------
  if (info.intencion === "pregunta") {
    const resp = await responderConocimiento(txt);
    return `${emoción} ${resp}`;
  }

  // ---------------------------
  // PASO: COMUNA
  // ---------------------------
  if (state.step === "comuna") {
    let comuna = await validarComunaChile(txt);

    if (comuna === "NO") {
      return `${emoción} No logré reconocer la comuna 😅\n¿Puedes repetirla?`;
    }

    if (!COMUNAS.includes(comuna)) {
      state.step = "pedido";
      state.entrega = "retiro";
      state.comuna = comuna;

      return (
        `${emoción} No tenemos despacho en *${comuna}* 😔\n` +
        `Puedes retirar en *Calle Chacabuco 1120, Santiago Centro*.\n¿Qué deseas pedir?`
      );
    }

    state.entrega = "domicilio";
    state.comuna = comuna;
    state.horario = "09:00 - 14:00";
    state.step = "pedido";

    return (
      `${emoción} Perfecto 😊 hacemos despacho en *${comuna}*.\n` +
      `Horario aprox: *${state.horario}*.\n¿Qué deseas pedir?`
    );
  }

  // ---------------------------
  // PASO: PEDIDO
  // ---------------------------
  if (state.step === "pedido") {
    if (txt.includes("nada más") || txt.includes("nada mas") || txt === "listo") {
      if (state.pedido.length === 0)
        return `${emoción} Aún no tengo productos anotados 😅\n¿Qué deseas pedir?`;

      state.step = "nombre";
      return `${emoción} ¿Cuál es tu nombre y apellido?`;
    }

    if (info.intencion === "pedido" && info.pedido) {
      state.pedido.push(info.pedido);
    } else {
      state.pedido.push(mensaje);
    }

    return `${emoción} Anotado 😊\n¿Algo más?`;
  }

  // ---------------------------
  // NOMBRE
  // ---------------------------
  if (state.step === "nombre") {
    state.datos.nombre = mensaje;
    state.step = "direccion";
    return `${emoción} ¿Cuál es la dirección exacta?`;
  }

  // ---------------------------
  // DIRECCIÓN
  // ---------------------------
  if (state.step === "direccion") {
    state.datos.direccion = mensaje;
    state.step = "telefono2";
    return `${emoción} ¿Tienes algún teléfono adicional? (Si no, escribe *no*)`;
  }

  // ---------------------------
  // TELÉFONO 2
  // ---------------------------
  if (state.step === "telefono2") {
    state.datos.telefono2 = txt === "no" ? "" : mensaje;
    state.fecha = fechaEntrega();
    state.step = "confirmar";

    const resumen =
      `Resumen del pedido 📦\n` +
      state.pedido.map(p => `• ${p}`).join("\n") +
      `\n\nDatos:\n• Nombre: ${state.datos.nombre}\n• Dirección: ${state.datos.direccion}\n• Teléfono(s): ${state.phone}${state.datos.telefono2 ? " / " + state.datos.telefono2 : ""}\n• Comuna: ${state.comuna}\n\nEntrega: ${state.entrega === "domicilio"
        ? `Despacho el ${state.fecha} entre ${state.horario}`
        : `Retiro el ${state.fecha} en Calle Chacabuco 1120`
      }\n\n¿Confirmas el pedido? (sí)`;

    return `${emoción} ${resumen}`;
  }

  // ---------------------------
  // CONFIRMAR
  // ---------------------------
  if (state.step === "confirmar") {
    if (txt.startsWith("si")) {
      state.step = "final";

      // Guardamos en Supabase
      await supabase.from("pedidos").insert({
        telefono: state.phone,
        pedido: state.pedido,
      });

      return `${emoción} ¡Perfecto! Tu pedido quedó registrado ✅`;
    }
    return `${emoción} Para confirmar escribe *sí*.`;
  }

  // ---------------------------
  // FINAL
  // ---------------------------
  if (state.step === "final") {
    return `${emoción} Tu pedido ya está registrado 😊 Si deseas hacer otro, escribe *Hola*.`;
  }

  return `${emoción} No entendí 😅 ¿Puedes repetirlo?`;
}

// -----------------------------------------------------
// 🔵 ENDPOINT PRINCIPAL PARA WHATAUTO
// -----------------------------------------------------
app.post("/whatsapp", async (req, res) => {
  const body = req.body;

  console.log("📩 BODY RECIBIDO:", body);

  const phone = (body.phone || "").replace(/ /g, "").trim();
  const message = body.message || "";

  if (!phone) return res.json({ reply: "Error: falta número" });

  // Crear sesión si no existe
  if (!sesiones[phone]) sesiones[phone] = nuevaSesion(phone);

  const respuesta = await procesar(sesiones[phone], message);

  res.json({ reply: respuesta });
});

// -----------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor iniciado en el puerto ${PORT}`));
