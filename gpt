// gpt.js
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

import { RULES } from "./rules.js";
import { generarPrompt } from "./prompts.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderConGPT(texto, cliente, historial = []) {
  try {
    const prompt = generarPrompt(historial, texto, cliente);

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: RULES.intro },
        { role: "user", content: prompt }
      ]
    });

    return resp.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error("❌ Error en GPT:", e);
    return "Tuvimos un problema para responder 💛 por favor intenta de nuevo.";
  }
}
