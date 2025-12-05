const OpenAI = require("openai");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Interpreta qué quiso decir el cliente
async function interpretarMensaje(texto) {
  const prompt = `
Clasifica el mensaje del cliente con estas reglas:

1. intencion = saludo | pregunta | pedido | comuna | desconocido
2. pregunta: si el usuario pregunta "donde entregan", "que venden", "reparten en X"
3. comuna: si menciona una comuna (aunque esté mal escrita)
4. pedido: si nombra un producto o cantidad.
5. devolución:
{
  "intencion": "",
  "texto": "",
  "comuna": "",
  "pedido": "",
  "pregunta": ""
}
Mensaje: "${texto}"`;

  const r = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }]
  });

  try {
    return JSON.parse(r.choices[0].message.content);
  } catch {
    return { intencion: "desconocido", texto };
  }
}

// pregunta tipo FAQ usando rules
async function responderConocimiento(pregunta) {
  const prompt = `
Responde esta pregunta SOLO con la información del negocio Delicias Monte Luna.
Pregunta: ${pregunta}`;

  const r = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }]
  });

  return r.choices[0].message.content;
}

// validar comuna real
async function validarComunaChile(texto) {
  const prompt = `
¿"${texto}" es una comuna de Chile?  
Responde solo: "SI: nombre" o "NO"`;

  const r = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }]
  }).catch(() => null);

  if (!r) return "NO";
  return r.choices[0].message.content;
}

module.exports = {
  interpretarMensaje,
  responderConocimiento,
  validarComunaChile
};
