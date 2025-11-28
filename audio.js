// ===================================================
//  audio.js — Procesar notas de voz usando GPT-4o
// ===================================================

import OpenAI from "openai";
import fetch from "node-fetch";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Descargar audio desde URL (para Whatauto)
async function descargarAudioDesdeURL(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

// Convertir base64 en buffer
function base64ToBuffer(base64) {
  if (base64.includes("base64,")) {
    base64 = base64.split("base64,")[1];
  }
  return Buffer.from(base64, "base64");
}

// Transcribir con GPT-4o
async function transcribirConGPT4o(buffer) {
  try {
    const result = await openai.chat.completions.create({
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
              text: "Transcribe exactamente este audio a texto:"
            }
          ]
        }
      ]
    });

    return result.choices[0].message.content || "";
  } catch (error) {
    console.error("❌ Error al transcribir con GPT-4o:", error);
    return "";
  }
}

// FUNCIÓN PRINCIPAL
export async function procesarAudio(audioData) {
  try {
    let buffer = null;

    if (audioData?.url) {
      buffer = await descargarAudioDesdeURL(audioData.url);
    } else if (audioData?.base64) {
      buffer = base64ToBuffer(audioData.base64);
    }

    if (!buffer) return "";

    const texto = await transcribirConGPT4o(buffer);
    return texto;
    
  } catch (error) {
    console.error("❌ Error procesando audio:", error);
    return "";
  }
}
