require("dotenv").config();
const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* Interpretación del mensaje */
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres un analizador de intención. Responde en JSON.

Intenciones posibles:
- saludo
- pregunta
- comuna
- pedido
- otro

Detecta comuna SOLO si está en Chile.

Detecta emociones: feliz, neutro, molesto.

Retorna JSON:
{
  "intencion": "",
  "texto_normalizado": "",
  "emocion": "",
  "comuna": "",
  "pedido": ""
}

Mensaje del cliente: "${mensaje}"
`;

  const { choices } = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  try {
    return JSON.parse(choices[0].message.content);
  } catch {
    return { intencion: "otro", texto_normalizado: mensaje, emocion: "neutro" };
  }
}

/* Respuestas basadas en rules */
async function responderConocimiento(pregunta) {
  const prompt = `
Responde SOLO usando la información del catálogo y reglas dadas:

${rules.catalogo}
${rules.preguntasFrecuentes}

Pregunta: "${pregunta}"
`;
  const { choices } = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return choices[0].message.content;
}

/* Validación extendida de comunas en Chile */
async function validarComunaChile(texto) {
  const prompt = `
El usuario escribió: "${texto}"

Tu tarea: decidir si esto es una comuna real de Chile.
Responde SOLO el nombre exacto de la comuna o "NO".
`;

  const { choices } = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return choices[0].message.content.trim();
}

/* Emojis emocionales */
function respuestaEmocional(e) {
  if (e === "feliz") return "😊";
  if (e === "molesto") return "😥";
  return "🙂";
}

module.exports = {
  interpretarMensaje,
  responderConocimiento,
  validarComunaChile,
  respuestaEmocional
};
