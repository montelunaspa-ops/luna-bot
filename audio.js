// ===================================================
//  audio.js — Procesa notas de voz con GPT-4o
// ===================================================

import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Descargar audio desde URL
async function descargarAudioDesdeURL(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

// Base64 a buffer
function base64ToBuffer(base64) {
  if (base64.includes("base64,")) {
    base64 = base64.split("base64,")[1];
  }
  return Buffer.from(base64, "base64");
}

// Transcribir audio con GPT-4o
async function transcribirConGPT4o(buffer) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "input_audio",
              audio: buffer
            },
            {
              type: "text",
              text: "Transcribe este audio exactamente a texto:"
            }
          ]
        }
      ]
    });

    return response.choices[0].message.content || "";
  } catch (error) {
    console.error("❌ Error transcribiendo audio:", error);
    return "";
  }
}

// Función principal
export async function procesarAudio(audioData) {
  try {
    let buffer = null;

    if (audioData?.url) {
      buffer = await descargarAudioDesdeURL(audioData.url);
    } else if (audioData?.base64) {
      buffer = base64ToBuffer(audioData.base64);
    }

    if (!buffer) return "";
    return await transcribirConGPT4o(buffer);

  } catch (e) {
    console.error("❌ Error procesando audio:", e);
    return "";
  }
}
