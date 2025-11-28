// audio.js — Transcripción de notas de voz con Whisper
import OpenAI from "openai";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribirAudio(url) {
  try {
    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());

    const transcript = await openai.audio.transcriptions.create({
      model: "gpt-4o-mini-tts",
      file: buffer,
      response_format: "text"
    });

    return transcript.trim();
  } catch (error) {
    console.error("❌ Error al transcribir audio:", error);
    return "[audio no entendido]";
  }
}
