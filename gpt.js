const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ======================================================
   INTERPRETAR MENSAJE DEL CLIENTE (INTELIGENCIA REAL)
====================================================== */
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres un asistente experto en interpretación conversacional.
Tu tarea es analizar el mensaje del cliente y clasificarlo según:

• intención (saludo, pregunta, comuna, pedido, confirmación, agradecimiento, emocional, otro)
• comuna detectada (corrige ortografía si es posible)
• tipo de pregunta
• pedido formulado
• emoción (neutral, feliz, molesto, confundido, apurado, preocupado)
• texto normalizado

Solo usa comunas de esta lista:
${Object.keys(rules.horarios).join(", ")}

NO inventes información fuera del catálogo o reglas.

DEVUELVE SOLO este JSON SIN TEXTO ADICIONAL:

{
  "intencion": "",
  "comuna": "",
  "pregunta": "",
  "pedido": "",
  "emocion": "",
  "texto_normalizado": ""
}

Mensaje del cliente: "${mensaje}"
`;

  const result = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }]
  });

  return JSON.parse(result.choices[0].message.content);
}

/* ======================================================
   RESPUESTA EMPÁTICA SEGÚN EMOCIÓN
====================================================== */
function respuestaEmocional(emocion) {
  switch (emocion) {
    case "molesto":
      return "Lamento que hayas tenido una mala experiencia 😔 Estoy aquí para ayudarte en lo que necesites.";
    case "confundido":
      return "No te preocupes, te ayudo con gusto 😊";
    case "apurado":
      return "¡Vamos rápido! Te ayudo al tiro ⏱️";
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
  respuestaEmocional
};
