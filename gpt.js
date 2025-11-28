import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
import rules from "./rules.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderGPT(texto, cliente) {
  try {
    const prompt = `
Eres Luna, asistente virtual de Delicias Monte Luna.
Responde en mensajes cortos y claros.
Texto del cliente: ${texto}
    `;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: rules.intro },
        { role: "user", content: prompt }
      ]
    });

    return res.choices[0].message.content;
  } catch (e) {
    return "Hubo un problema para responder 💛 intenta otra vez.";
  }
}
