const OpenAI = require("openai");
const rules = require("./rules");
const { comunasChile } = require("./utils");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ===========================================================
   🟢 INTERPRETAR MENSAJE DEL CLIENTE
   =========================================================== */
async function interpretarMensaje(texto) {
  try {
    const prompt = `
Eres un analizador de mensajes para un bot de ventas de pastelería.
Devuelve SIEMPRE un JSON válido con:

{
  "intencion": "...",
  "pregunta": "...",
  "emocion": "...",
  "comuna": "...",
  "pedido": "...",
  "texto_normalizado": "..."
}

Reglas:
- "saludo" si dice hola, buenos días, etc.
- "pregunta" si pide información ("precio", "cuánto vale", "vende X").
- "pedido" si menciona un producto del catálogo.
- "comuna" debe ser detectada si corresponde.
- "emocion": neutral, feliz, molesto, confuso.

Texto del cliente:
"${texto}"
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "system", content: prompt }]
    });

    let res = completion.choices[0].message.content;

    try {
      return JSON.parse(res);
    } catch {
      return {
        intencion: "otro",
        emocion: "neutral",
        texto_normalizado: texto
      };
    }
  } catch (e) {
    console.error("❌ Error interpretarMensaje:", e);
    return {
      intencion: "otro",
      emocion: "neutral",
      texto_normalizado: texto
    };
  }
}

/* ===========================================================
   🟣 VALIDAR COMUNA DE TODO CHILE (GPT)
   =========================================================== */
async function validarComunaChile(texto) {
  try {
    const prompt = `
Analiza este texto y determina si contiene una comuna real de Chile.

Texto: "${texto}"

Devolver SOLO:
- El nombre exacto de la comuna si existe.
- "NO" si no corresponde a ninguna comuna de Chile.

Listado de comunas de Chile:
${comunasChile.join(", ")}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "system", content: prompt }]
    });

    let comuna = completion.choices[0].message.content.trim();
    return comuna;
  } catch (e) {
    console.error("❌ Error validarComunaChile:", e);
    return "NO";
  }
}

/* ===========================================================
   🟣 RESPONDER PREGUNTAS BASADAS EN rules.js
   =========================================================== */
async function responderConocimiento(pregunta) {
  try {
    const prompt = `
Tu tarea es responder preguntas SOLO usando la información siguiente:

CATÁLOGO:
${rules.catalogo}

COMUNAS:
${rules.comunasCobertura.join(", ")}

HORARIOS:
${JSON.stringify(rules.horarios)}

Debes ser breve, claro y amable.

Pregunta del cliente:
"${pregunta}"
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "system", content: prompt }]
    });

    return completion.choices[0].message.content.trim();
  } catch (e) {
    console.error("❌ Error responderConocimiento:", e);
    return "No tengo información exacta de eso, pero puedo ayudarte 😊";
  }
}

/* ===========================================================
   🟣 RESPUESTA EMOCIONAL
   =========================================================== */
function respuestaEmocional(tipo) {
  switch (tipo) {
    case "feliz": return "😊";
    case "molesto": return "😟";
    case "confuso": return "🤔";
    default: return "😊";
  }
}

module.exports = {
  interpretarMensaje,
  validarComunaChile,
  responderConocimiento,
  respuestaEmocional
};
