// ===================================================
//  audio.js — Procesa notas de voz y las transcribe
// ===================================================

import OpenAI from "openai";
import fetch from "node-fetch";
import fs from "fs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// =======================================
//  Descargar audio desde URL (Whatauto)
// =======================================
async function descargarAudioDesdeURL(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}

// =======================================
//  Convertir base64 a buffer
// =======================================
function base64ToBuffer(base64) {
  // Si viene con encabezado estilo "data:audio/ogg;base64,..."
  if (base64.includes("base64,")) {
    base64 = base64.split("base64,")[1];
  }
  return Buffer.from(base64, "base64");
}

// =======================================
//  Transcribir usando GPT-4o
// =======================================
async function transcribirAudio(buffer) {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: buffer,
      model: "gpt-4o-mini-transcribe",
      response_format: "text"
    });

    return transcription || "";
  } catch (error) {
    console.error("❌ Error transcribiendo audio:", error);
    return "";
  }
}

// =======================================
//  FUNCIÓN PRINCIPAL
//  Procesa nota de voz → devuelve TEXTO
// =======================================
export async function procesarAudio(audioData) {
  try {
    let buffer = null;

    // 1) Audio en URL
    if (audioData?.url) {
      buffer = await descargarAudioDesdeURL(audioData.url);
    }

    // 2) Audio en base64
    else if (audioData?.base64) {
      buffer = base64ToBuffer(audioData.base64);
    }

    // Si no hay audio
    if (!buffer) return "";

    // Transcribir
    const texto = await transcribirAudio(buffer);
    return texto || "";
  } catch (error) {
    console.error("Error procesando audio:", error);
    return "";
  }
}
