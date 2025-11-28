// classifier.js — GPT clasifica comuna, pregunta o texto
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
import rules from "./rules.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function clasificarMensaje(texto) {
  try {
    const prompt = `
Clasifica el siguiente mensaje con UNA sola palabra:

CATEGORÍAS POSIBLES:
1) "comuna_valida" → si el cliente escribió una comuna exacta de esta lista:
${rules.comunas.join(", ")}

2) "comuna_invalida" → si es una comuna real de Chile pero NO está en la lista.

3) "pregunta" → si el cliente está preguntando o buscando información.

4) "otro" → si no corresponde a nada de lo anterior.

Mensaje:
"${texto}"

RESPUESTA (solo la categoría):
`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    });

    return r.choices[0].message.content.trim();
  } catch (e) {
    console.log("❌ Error clasificando mensaje:", e);
    return "otro";
  }
}
