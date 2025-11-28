import OpenAI from "openai";
import { obtenerReglas } from "./lunaRules.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderGPT(mensaje, cliente, contextoFlujo) {
  const reglas = await obtenerReglas();

  const prompt = `
Eres Luna Bot, un asistente de ventas de pastelería. 
Siempre respondes en texto corto, amable y directo.
Usa SOLO la información disponible en las reglas del negocio:

${JSON.stringify(reglas, null, 2)}

Datos del cliente:
${JSON.stringify(cliente)}

Estado del flujo:
${JSON.stringify(contextoFlujo)}

Mensaje del cliente:
"${mensaje}"

Instrucciones:
1. Responde en máximo 2 líneas.
2. Nunca inventes información.
3. Usa solo reglas de la BD.
4. Si el cliente pregunta algo fuera del flujo, respóndelo y luego vuelve al flujo.
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content;
}
