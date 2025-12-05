const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/* ============================================================
   🧠 MODELO PRINCIPAL: CLASIFICADOR DE INTENCIONES GPT
   ============================================================ */
async function interpretarMensaje(mensaje) {
  try {
    const prompt = `
Eres un clasificador inteligente de mensajes para un bot de ventas llamado Luna.
Debes analizar el mensaje del cliente y responder SOLO un JSON válido sin comentarios.

Tu tarea es detectar:
- intención: saludo | despedida | pregunta | comuna | producto | pedido | desconocido
- emoción: neutral | feliz | molesto | confundido | triste
- texto_normalizado: versión limpia del mensaje
- comuna: si el mensaje es una comuna o contiene una comuna (NO inventar)
- pedido: si menciona un producto del catálogo de Delicias Monte Luna
- pregunta: si está haciendo una pregunta
- producto: si menciona productos aunque NO esté haciendo un pedido

Reglas importantes:

1. NO debes clasificar productos como comunas.
2. Si el mensaje dice algo como “brazo de reina”, “pan”, “muffins”, “que venden”, etc., es intención "producto" o "pregunta".
3. Si hay una pregunta, la intención SIEMPRE debe ser "pregunta".
4. NO inventar comunas: solo reconocer comunas reales.
5. NO asumir que un producto es un pedido a menos que el mensaje claramente lo indique.
6. Si el mensaje contiene emociones (ej: frustración), detectarlas.
7. Si el mensaje está vacío o irrelevante, intención “desconocido”.

Catálogo de productos válidos:
${rules.productosLista}

Comunas con cobertura:
${rules.comunasCobertura.join(", ")}

El mensaje del cliente es:
"${mensaje}"

Devuelve SOLO este formato JSON:
{
  "intencion": "",
  "emocion": "",
  "texto_normalizado": "",
  "comuna": "",
  "pedido": "",
  "pregunta": ""
}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [{ role: "user", content: prompt }]
    });

    let result = completion.choices[0].message.content.trim();

    try {
      return JSON.parse(result);
    } catch (e) {
      return {
        intencion: "desconocido",
        emocion: "neutral",
        texto_normalizado: mensaje,
        comuna: "",
        pedido: "",
        pregunta: ""
      };
    }

  } catch (error) {
    console.error("❌ Error en interpretarMensaje:", error);
    return {
      intencion: "desconocido",
      emocion: "neutral",
      texto_normalizado: mensaje,
      comuna: "",
      pedido: "",
      pregunta: ""
    };
  }
}

/* ============================================================
   🧠 RESPUESTAS INTELIGENTES BASADAS EN RULES
   ============================================================ */
async function responderConocimiento(pregunta) {
  try {
    const prompt = `
Eres Luna, una asistente de ventas amable y concisa.
Debes responder SOLO usando la información del siguiente bloque (rules):

${rules.baseConocimiento}

Pregunta del cliente:
"${pregunta}"

Responde de forma:
- corta
- amable
- clara
- sin inventar información que no esté en rules.
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }]
    });

    return completion.choices[0].message.content.trim();

  } catch (err) {
    console.error("❌ Error en responderConocimiento:", err);
    return "Puedo ayudarte con eso 😊 ¿Qué más deseas saber?";
  }
}

/* ============================================================
   🧠 VALIDACIÓN INTELIGENTE DE COMUNAS DE CHILE
   ============================================================ */
async function validarComunaChile(texto) {
  try {
    const prompt = `
Valida si el siguiente texto contiene una comuna real de Chile:

"${texto}"

Debes devolver SOLO:
- Nombre exacto de la comuna (si existe)
- O "NO" si no es una comuna válida

Reglas:
- No inventar comunas.
- Si el texto menciona productos o preguntas, DEVOLVER "NO".
- No confundir productos con comunas.
- Responder solo el nombre de la comuna o "NO".
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.0,
      messages: [{ role: "user", content: prompt }]
    });

    return completion.choices[0].message.content.trim();

  } catch (e) {
    console.error("❌ Error validarComunaChile:", e);
    return "NO";
  }
}

/* ============================================================
   🧠 RESPUESTA EMOCIONAL
   ============================================================ */
function respuestaEmocional(emocion) {
  switch (emocion) {
    case "feliz":
      return "😊";
    case "molesto":
      return "😟";
    case "triste":
      return "😔";
    case "confundido":
      return "🤔";
    default:
      return "😊";
  }
}

module.exports = {
  interpretarMensaje,
  responderConocimiento,
  validarComunaChile,
  respuestaEmocional
};
