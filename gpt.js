// gpt.js — Versión B (restaurada)
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
import rules from "./rules.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderGPT(texto, cliente) {
  try {
    const prompt = `
Eres Luna 💛 asistente virtual de Delicias Monte Luna.

REGLAS:
- Responde corto, amable y directo.
- NO inventes nada.
- Solo usa la información del catálogo y reglas oficiales.
- Si el cliente pregunta algo fuera de la información → responde:
  "Lo siento 💛, esa información no está disponible."
- No debes modificar el flujo del pedido.
- No debes pedir datos de despacho.
- No debes pedir la comuna.
- Solo responde dudas del cliente.

CATÁLOGO OFICIAL:
${rules.catalogo_completo}

COMUNAS DE REPARTO:
${rules.comunas.join(", ")}

HORARIOS:
${JSON.stringify(rules.horarios)}

RETIRO:
${rules.retiro_domicilio}

Métodos de pago:
${rules.metodos_pago}

Cliente:
${JSON.stringify(cliente)}

Mensaje del cliente: "${texto}"
`;

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0, // NO creatividad
      messages: [
        { role: "system", content: rules.intro },
        { role: "user", content: prompt }
      ]
    });

    return res.choices[0].message.content.trim();
  } catch (e) {
    console.log("❌ Error GPT:", e);
    return "Hubo un problema 💛 intenta otra vez.";
  }
}
