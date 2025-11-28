import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
import rules from "./rules.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderGPT(texto, cliente) {
  try {
    const prompt = `
Eres Luna 💛 Asistente virtual de Delicias Monte Luna.

REGLAS IMPORTANTES:
- Responde siempre corto, amable y directo.
- Usa SOLO la información del catálogo, comunas, horarios y reglas.
- No inventes productos, precios ni comunas.
- Puedes responder preguntas en cualquier momento.
- Después de responder, el bot retomará el flujo.

CATÁLOGO:
${rules.catalogo_completo}

COMUNAS DE ENVÍO:
${rules.comunas.join(", ")}

HORARIOS:
${JSON.stringify(rules.horarios)}

Mensaje del cliente: "${texto}"
`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }]
    });

    return r.choices[0].message.content.trim();
  } catch (e) {
    console.log("❌ Error GPT:", e);
    return "Hubo un problema 💛 intenta nuevamente.";
  }
}
