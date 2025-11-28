// ===============================================
//  gpt.js — Motor de conversación (GPT-4o 100% control)
// ===============================================

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function responderGPT({
  mensajeOriginal,
  mensajeNormalizado,
  reglas,
  historial,
  cliente
}) {
  const prompt = `
Eres Luna Bot, asistente virtual oficial de Delicias Monte Luna.

REGLAS ABSOLUTAS:
- TODA tu inteligencia depende exclusivamente de los datos entregados por la base de datos (reglas).
- No inventes productos, precios, horarios ni comunas que no existan.
- Responde SIEMPRE en máximo 2 líneas.
- Puedes responder preguntas fuera del flujo y luego retomar la venta.
- Usa el historial para saber en qué paso va el cliente.
- Reconoce comunas aunque estén mal escritas.
- Reconoce productos, sabores, cantidades, direcciones y datos personales aunque estén incompletos.
- Evita loops. Nunca pidas la misma cosa dos veces.
- Cuando tengas todos los datos → genera RESUMEN FINAL.
- Si el cliente confirma → responde que el pedido quedó agendado ✔️.

DATOS DEL NEGOCIO (desde BD):
${JSON.stringify(reglas, null, 2)}

HISTORIAL COMPLETO:
${JSON.stringify(historial, null, 2)}

DATOS DEL CLIENTE:
${JSON.stringify(cliente, null, 2)}

MENSAJE DEL CLIENTE:
"${mensajeOriginal}"

TAREA:
1. Determina qué información ya entregó el cliente.
2. Determina qué información falta.
3. Avanza automáticamente al siguiente paso.
4. Evita repetir preguntas.
5. Responde de manera clara, natural, amable y muy breve.

RESPUESTA:
Envía SOLO el texto que debo mandar al cliente.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }]
  });

  return completion.choices[0].message.content;
}
