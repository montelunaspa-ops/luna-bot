const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ======================================================
   🧠 INTERPRETAR MENSAJE (intención + emoción + comuna)
====================================================== */
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres un asistente experto en interpretación de WhatsApp.

Analiza el mensaje y devuelve un JSON con:
- intencion: saludo | pregunta | comuna | pedido | confirmacion | agradecimiento | otro
- comuna: si detectas una comuna (corrige si está mal escrita)
- pregunta: la pregunta clara del cliente
- pedido: si expresa un producto o cantidad
- emocion: neutral | feliz | molesto | confundido | apurado | preocupado
- texto_normalizado: mensaje limpiado

NO INVENTES INFORMACIÓN.

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

/* ======================================================
   🧠 RESPONDER CON SOLO LA INFORMACIÓN DE rules.js
====================================================== */
async function responderConocimiento(pregunta) {
  const prompt = `
Contesta la siguiente pregunta usando EXCLUSIVAMENTE la información dada en este bloque:

-------------------------
CATALOGO:
${rules.catalogo}

COMUNAS:
${rules.comunas}

HORARIOS:
${JSON.stringify(rules.horarios, null, 2)}

POLITICAS:
${rules.politicas}
-------------------------

REGLAS IMPORTANTES:
- NO inventar información
- NO agregar datos que no existan en rules.js
- Responde corto y claro (WhatsApp style)
- Si no está en la información, responde: "No tengo esa información, pero puedo ayudarte con tu pedido 😊"

PREGUNTA DEL CLIENTE:
"${pregunta}"

RESPUESTA:
`;

  const result = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  });

  return result.choices[0].message.content;
}

/* ======================================================
   😊 INTELIGENCIA EMOCIONAL
====================================================== */
function respuestaEmocional(emocion) {
  switch (emocion) {
    case "molesto":
      return "Lamento que tengas esa experiencia 😔 Estoy aquí para ayudarte.";
    case "confundido":
      return "No te preocupes, te explico con gusto 😊";
    case "apurado":
      return "Vamos rapidito ⏱️";
    case "preocupado":
      return "Tranquilo/a, aquí estoy para ayudarte 🤗";
    case "feliz":
      return "¡Me alegra saberlo! 😊";
    default:
      return "";
  }
}

module.exports = {
  interpretarMensaje,
  responderConocimiento,
  respuestaEmocional
};
