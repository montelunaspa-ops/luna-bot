import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
import rules from "./rules.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderGPT(texto, cliente) {
  try {
    const prompt = `
Eres Luna, asistente virtual. Responde corto, amable y solo con la información oficial.
Cliente: ${texto}
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
    console.log("GPT error:", e);
    return "Ocurrió un error 💛 intenta de nuevo.";
  }
}
