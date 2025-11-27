import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const rules = require("./rules.json");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderGPT(texto, historial, cliente) {
  try {
    const prompt = `
Eres Luna, asistente virtual de Delicias Monte Luna.
Responde corto, amable y preciso.
Usa SOLO la información del catálogo y reglas.
No inventes nada.

Cliente escribió: ${texto}
`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: rules.intro },
        { role: "user", content: prompt }
      ]
    });

    return res.choices[0].message.content;
  } catch (e) {
    return "Tuvimos un problema 💛 intenta de nuevo.";
  }
}
