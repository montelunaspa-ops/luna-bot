import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
import rules from "./rules.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function clasificarMensaje(texto) {
  try {
    const prompt = `
Clasifica el mensaje SOLO con una palabra:

CATEGORÍAS POSIBLES:
1) comuna_valida
2) comuna_invalida
3) pregunta
4) otro

COMUNAS VÁLIDAS:
${rules.comunas.join(", ")}

Mensaje:
"${texto}"
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
