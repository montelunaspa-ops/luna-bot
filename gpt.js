require("dotenv").config();
const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* Interpretación del mensaje */
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres un analizador de intención. Responde en JSON estricto.

Intenciones:
- saludo
- pregunta
- comuna
- pedido
- otro

Emociones:
- feliz
- neutro
- molesto

Retorna:
{
  "intencion": "",
  "texto_normalizado": "",
  "emocion": "",
  "comuna": "",
  "pedido": ""
}

Mensaje: "${mensaje}"
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

/* Respuestas usando catálogo */
async function responderConocimiento(pregunta) {
  const prompt = `
Responde SOLO con la información del catálogo oficial:

CATÁLOGO:
${rules.catalogo}

PREGUNTAS FRECUENTES:
${rules.preguntasFrecuentes}

Pregunta del cliente: "${pregunta}"
`;

  const { choices } = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return choices[0].message.content.trim();
}

/* Validar comuna de Chile */
async function validarComunaChile(texto) {
  const prompt = `
El usuario escribió: "${texto}"

Responde SOLO:
- el nombre exacto de la comuna si existe en Chile
- o "NO"
`;

  const { choices } = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return choices[0].message.content.trim();
}

/* Emoji emocional */
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
