require("dotenv").config();
const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ============================================================
   🧠 INTERPRETACIÓN INTELIGENTE DEL MENSAJE
   ============================================================ */
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres un analizador de intención para un bot de ventas de repostería.
Debes responder **EXCLUSIVAMENTE en JSON válido**, sin comentarios.

Intenciones permitidas:
- saludo
- pregunta
- comuna
- pedido
- otro

DETECTA:
✔ Si el usuario está saludando.
✔ Si está haciendo una pregunta.
✔ Si está diciendo una comuna de Chile.
✔ Si está pidiendo productos del catálogo (queques, galletas, muffins, alfajores, etc.)
✔ Emoción (feliz, neutro, molesto).

EXTRA:
- "pedido" debe incluir producto y cantidad cuando sea posible.  
- Si no hay cantidad, coloca "".
- "texto_normalizado" es la versión limpia del mensaje.

Formato JSON obligatorio:
{
  "intencion": "",
  "texto_normalizado": "",
  "emocion": "",
  "comuna": "",
  "pedido": ""
}

Mensaje del cliente: "${mensaje}"
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  const raw = response.choices[0].message.content.trim();

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.log("⚠ Error parseando JSON de interpretarMensaje:", raw);
    return {
      intencion: "otro",
      texto_normalizado: mensaje,
      emocion: "neutro",
      comuna: "",
      pedido: ""
    };
  }
}

/* ============================================================
   📘 RESPUESTAS BASADAS EN RULES
   ============================================================ */
async function responderConocimiento(pregunta) {
  const prompt = `
Responde únicamente usando el catálogo y la información oficial:

CATÁLOGO:
${rules.catalogo}

PREGUNTAS FRECUENTES:
${rules.preguntasFrecuentes}

Pregunta del cliente:
"${pregunta}"

Responde en tono amable y directo.
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return response.choices[0].message.content.trim();
}

/* ============================================================
   🏙 VALIDAR SI ES UNA COMUNA REAL DE CHILE
   ============================================================ */
async function validarComunaChile(texto) {
  const prompt = `
El usuario escribió: "${texto}"

Tu tarea:
✔ Determinar si esto corresponde a una comuna REAL de Chile.
✔ Si NO es una comuna, responde exactamente: "NO"
✔ Si SÍ es comuna, responde SOLO el nombre exacto.

Ejemplos válidos:
"Maipú" → Maipú
"macul" → Macul
"quiero pedir" → NO
"Hola" → NO
"brazo de reina" → NO
`;

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return response.choices[0].message.content.trim();
}

/* ============================================================
   😊 EMOJIS EMOCIONALES
   ============================================================ */
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
