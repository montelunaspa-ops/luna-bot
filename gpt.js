// gpt.js — versión final
import OpenAI from "openai";
import dotenv from "dotenv";
import rules from "./rules.js";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderGPT(texto, cliente) {
  try {
    const prompt = `
Eres ${rules.asistente}.
Respondes SIEMPRE con mensajes cortos y amables (1–3 líneas).

REGLA GLOBAL:
• El cliente puede preguntar lo que quiera en cualquier momento.
• Responde SIEMPRE a su pregunta con la información oficial.
• Después de responder, tu mensaje debe dar pie a continuar el pedido.
• No inventes productos, precios ni información.
• Usa solo el catálogo oficial, comunas, horarios, reglas y políticas definidas.
• Si pregunta por algo que NO existe: respóndelo y redirígelo con amabilidad.

CATÁLOGO:
${rules.catalogo_texto}

COMUNAS CON DESPACHO:
${rules.comunas_reparto.join(", ")}

HORARIOS:
${JSON.stringify(rules.horarios_entrega, null, 2)}

REGLAS DE ENVÍO:
- Despacho gratis desde $${rules.reglas_envio.despacho_gratis}
- Envío $${rules.reglas_envio.costo_envio}
- Domingos no hay despacho
- Retiro en: ${rules.reglas_envio.domicilio_retiro}
- Entregas presenciales: ${rules.reglas_envio.entrega_presencial}
- Métodos de pago: ${rules.reglas_envio.pago.join(" o ")}

CLIENTE:
${JSON.stringify(cliente || {}, null, 2)}

MENSAJE DEL CLIENTE:
"${texto}"

Responde ahora respetando TODAS las reglas.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Eres Luna, asistente 100% basada en reglas oficiales. Nunca inventas nada."
        },
        { role: "user", content: prompt }
      ]
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error("❌ GPT ERROR:", err);
    return "Hubo un problema al responder 💛 intenta nuevamente.";
  }
}
