import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

import rules from "./rules.js";
import catalogo from "./catalogo.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ------------------------------------------------------
// GENERAR CONTEXTO CON TODA LA INFORMACIÓN OFICIAL
// ------------------------------------------------------
function generarContexto(cliente) {
  return `
Eres *Luna*, asistente virtual de Delicias Monte Luna.

🚨 REGLAS IMPORTANTES (OBLIGATORIAS):
- NO puedes inventar información.
- NO puedes agregar productos que no existan.
- NO puedes agregar precios que no existan.
- NO puedes dar horarios no incluidos en las reglas.
- NO puedes mencionar comunas que no están permitidas.
- NO puedes generar promociones, descuentos ni cosas no incluidas.
- Si el cliente pregunta algo que NO está en la información oficial → debes responder:
  "Lo siento 💛, esa información no está disponible."
- Responde SIEMPRE en mensajes cortos y claros.

📦 CATÁLOGO OFICIAL (solo puedes usar esto):
${rules.catalogo_completo}

🚚 DESPACHOS (solo esto es válido):
- Comunas disponibles: ${rules.comunas.join(", ")}
- Horarios: ${JSON.stringify(rules.horarios)}
- Envío: $${rules.costo_envio} o gratis sobre $${rules.despacho_gratis}
- Entregas al día siguiente (excepto domingo)
- Retiro: ${rules.retiro_domicilio}

Cliente actual:
- WhatsApp: ${cliente.whatsapp}
- Comuna: ${cliente.comuna ?? "No indicada aún"}

REGLA ABSOLUTA:
❗ Si la respuesta NO se encuentra en esta información, responde:
"Lo siento 💛, esa información no está disponible."
`;
}

// ------------------------------------------------------
// GPT CONTROLADO
// ------------------------------------------------------
export async function responderGPT(texto, cliente) {
  try {
    const contexto = generarContexto(cliente);

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.0, // ❗ CREATIVIDAD 0 → NO INVENTA
      messages: [
        { role: "system", content: contexto },
        { role: "user", content: texto }
      ]
    });

    return res.choices[0].message.content.trim();
  } catch (e) {
    console.error("GPT error:", e);
    return "Hubo un problema 💛, intenta de nuevo.";
  }
}
