const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ============================================
   INTERPRETAR MENSAJE (intención básica)
============================================ */
async function interpretarMensaje(mensaje) {
  try {
    const prompt = `
Eres un clasificador de mensajes para un bot de WhatsApp que vende pastelería.

Debes analizar el mensaje y devolver SOLO un JSON con esta forma:
{
  "intencion": "saludo | pregunta | pedido | otro",
  "texto_normalizado": "",
  "pregunta": ""
}

Reglas:
- "saludo" si dice hola, buenas, buen día, etc.
- "pregunta" si hay signos de pregunta o comienza con qué, donde/dónde, cómo, cuánto, tienen, vende(n), etc.
- "pedido" si menciona explícitamente productos, cantidades o "quiero", "me das", "necesito" algo del catálogo (queques, muffins, galletas, alfajores, cachitos, queque rectangular).
- En caso de duda, usar "otro".
- texto_normalizado: versión simple del mensaje en minúsculas.
- pregunta: si es pregunta, copia aquí la pregunta principal; en caso contrario, deja cadena vacía.

Mensaje del cliente:
"${mensaje}"
`;

    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }]
    });

    const raw = r.choices[0].message.content.trim();

    try {
      return JSON.parse(raw);
    } catch {
      return {
        intencion: "otro",
        texto_normalizado: mensaje.toLowerCase(),
        pregunta: ""
      };
    }
  } catch (e) {
    console.error("❌ Error en interpretarMensaje:", e);
    return {
      intencion: "otro",
      texto_normalizado: mensaje.toLowerCase(),
      pregunta: ""
    };
  }
}

/* ============================================
   RESPONDER PREGUNTAS (FAQ / información)
============================================ */
async function responderConocimiento(pregunta) {
  try {
    const prompt = `
Eres Luna, asistente virtual de Delicias Monte Luna.

Responde de forma CORTA, CLARA y AMABLE usando SOLO esta información:

CATÁLOGO:
${rules.catalogo}

COMUNAS DE DESPACHO:
${rules.comunasTexto}

INFORMACIÓN GENERAL:
${rules.baseConocimiento}

Pregunta del cliente:
"${pregunta}"
`;

    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    });

    return r.choices[0].message.content.trim();
  } catch (e) {
    console.error("❌ Error en responderConocimiento:", e);
    return "Puedo ayudarte con esa información 😊";
  }
}

/* ============================================
   VALIDAR COMUNA DE CHILE (GPT)
============================================ */
async function validarComunaChile(texto) {
  try {
    const prompt = `
Valida si el siguiente texto contiene una comuna real de Chile:

"${texto}"

Responde SOLO de estas dos formas:
- "SI: NombreDeComuna"
- "NO"
`;

    const r = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    });

    return r.choices[0].message.content.trim();
  } catch (e) {
    console.error("❌ Error en validarComunaChile:", e);
    return "NO";
  }
}

module.exports = {
  interpretarMensaje,
  responderConocimiento,
  validarComunaChile
};
