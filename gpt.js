require("dotenv").config();
const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ===========================================================
   🟢 Interpretación del mensaje (corregida y mejorada)
   =========================================================== */
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres un analizador experto.

Tu misión es detectar la INTENCIÓN DEL CLIENTE con alta precisión.

SIEMPRE devuelve JSON válido con esta forma exacta:

{
  "intencion": "",
  "texto_normalizado": "",
  "emocion": "",
  "comuna": "",
  "pedido": ""
}

-----------------------------------
REGLAS DE CLASIFICACIÓN DE INTENCIÓN
-----------------------------------

1️⃣ **saludo**
   - hola, buenas, qué tal, hi, etc.

2️⃣ **pregunta**
   Se considera pregunta aunque NO tenga "?" si contiene palabras relacionadas a información:
   - donde entrega / donde entregan
   - donde reparten / donde envían
   - despacho
   - entrega
   - horario
   - precio / cuánto vale
   - cuánto cuesta
   - qué venden
   - disponibilidad
   - envíos
   - atienden hoy
   - etc.

   Si el usuario pide información → ES PREGUNTA.

3️⃣ **comuna**
   Si el texto corresponde al nombre de una comuna real de Chile.

4️⃣ **pedido**
   Si menciona productos: queques, galletas, muffins, alfajores, brazo de reina, etc.
   - Extraer el producto en "pedido".

5️⃣ **otro**
   Si no corresponde a ninguna categoría.

-----------------------------------
EMOCIONES:
- feliz
- neutro
- molesto

-----------------------------------

Mensaje del cliente: "${mensaje}"
Retorna SOLO JSON. Sin texto adicional.
`;

  const { choices } = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  try {
    return JSON.parse(choices[0].message.content);
  } catch {
    return {
      intencion: "otro",
      texto_normalizado: mensaje,
      emocion: "neutro",
      comuna: "",
      pedido: ""
    };
  }
}

/* ===========================================================
   🟢 Respuestas basadas en catálogo
   =========================================================== */
async function responderConocimiento(pregunta) {
  const prompt = `
Responde usando SOLO esta información:

${rules.catalogo}
${rules.preguntasFrecuentes}

Pregunta:
"${pregunta}"
`;

  const { choices } = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return choices[0].message.content;
}

/* ===========================================================
   🟢 Validación de comuna de Chile
   =========================================================== */
async function validarComunaChile(texto) {
  const prompt = `
El usuario escribió: "${texto}"

¿Es una comuna real de Chile?
Responde SOLO:
- El nombre exacto de la comuna, o
- "NO"
`;

  const { choices } = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return choices[0].message.content.trim();
}

/* Emojis */
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
