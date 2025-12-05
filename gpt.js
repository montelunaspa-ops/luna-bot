const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* 🧠 Interpretar mensaje (intención, comuna, emoción, etc.) */
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres un asistente experto en interpretación de mensajes de WhatsApp.

Analiza el mensaje y devuelve un JSON con:
- intencion: saludo | pregunta | comuna | pedido | confirmacion | agradecimiento | otro
- comuna: si detectas que el usuario menciona una comuna
- pregunta: si formula una pregunta, reescríbela de forma clara
- pedido: si habla de un producto o cantidad, describelo corto
- emocion: neutral | feliz | molesto | confundido | apurado | preocupado
- texto_normalizado: el mensaje limpio y entendible

NO inventes información.

Mensaje del cliente: "${mensaje}"

Responde SOLO este JSON:
{
  "intencion": "",
  "comuna": "",
  "pregunta": "",
  "pedido": "",
  "emocion": "",
  "texto_normalizado": ""
}
`;

  const result = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }]
  });

  return JSON.parse(result.choices[0].message.content);
}

/* 🧠 Responder usando SOLO la info de rules.js */
async function responderConocimiento(pregunta) {
  const prompt = `
Responde la siguiente pregunta usando EXCLUSIVAMENTE esta información:

-------------------------
CATÁLOGO:
${rules.catalogo}

COMUNAS CON DESPACHO:
${rules.comunasTexto}

HORARIOS POR COMUNA:
${JSON.stringify(rules.horarios, null, 2)}

POLÍTICAS:
${rules.politicas}
-------------------------

REGLAS:
- NO inventes información.
- NO agregues datos que no estén en el bloque.
- Responde corto, claro, estilo WhatsApp.
- Si no está la respuesta, di: "No tengo esa información, pero puedo ayudarte con tu pedido 😊".

PREGUNTA DEL CLIENTE:
"${pregunta}"

RESPUESTA:
`;

  const result = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  return result.choices[0].message.content.trim();
}

/* 🧠 Validar comuna real de Chile (no solo cobertura) */
async function validarComunaChile(nombre) {
  const prompt = `
Eres un verificador de comunas de Chile.

TAREA:
1. Si el texto es una comuna REAL de Chile, responde SOLO el nombre correcto.
2. Si NO es una comuna real, responde EXACTAMENTE: "NO".

Ejemplos:
"San migul" -> "San Miguel"
"Quilicura" -> "Quilicura"
"Macul" -> "Macul"
"Locura" -> "NO"

Comuna a validar: "${nombre}"
`;

  const result = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  return result.choices[0].message.content.trim();
}

/* 😊 Inteligencia emocional */
function respuestaEmocional(emocion) {
  switch (emocion) {
    case "molesto":
      return "Lamento que hayas tenido una mala experiencia 😔 Estoy aquí para ayudarte.";
    case "confundido":
      return "No te preocupes, te ayudo con gusto 😊";
    case "apurado":
      return "Vamos rapidito ⏱️";
    case "preocupado":
      return "Tranquilo/a, estoy aquí para ayudarte 🤗";
    case "feliz":
      return "¡Qué bueno! 😊";
    default:
      return "";
  }
}

module.exports = {
  interpretarMensaje,
  responderConocimiento,
  validarComunaChile,
  respuestaEmocional
};
