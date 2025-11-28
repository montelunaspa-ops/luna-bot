import OpenAI from "openai";
import { normalizar } from "./normalize.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderGPT(
  mensajeCliente,
  cliente,
  historial,
  contextoFlujo,
  listaComunas
) {
  const prompt = `
Eres Luna Bot, asistente virtual de Delicias Monte Luna.

COMUNAS DISPONIBLES (normalizadas):
${JSON.stringify(listaComunas)}

MENSAJE DEL CLIENTE:
"${mensajeCliente}"

HISTORIAL:
${JSON.stringify(historial)}

REGLAS:
- Detecta si el mensaje corresponde a una comuna revisando coincidencias parciales.
- Si el mensaje contiene parte de una comuna válida, acéptala.
- Si ya detectaste la comuna, NO vuelvas a pedirla.
- Si la comuna NO está en la lista, ofrece retiro en Calle Chacabuco 1120.
- Avanza al siguiente paso automáticamente (producto → cantidad → fecha → dirección → nombre → resumen).
- Responde en 1–2 líneas.
- Nunca repitas preguntas si ya fueron respondidas.

IMPORTANTE:
Reconoce comunas aunque estén incompletas, sin tildes o con errores ortográficos.

EJEMPLOS QUE DEBES ACEPTAR:
"san migel" → San Miguel
"renca" → Renca
"inde" → Independencia
"lo espejo pac" → Lo Espejo
"pu dahue" → Pudahuel
"maipu" → Maipú

TAREA:
Da la respuesta correcta según el flujo y lo que falte.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  return completion.choices[0].message.content;
}
