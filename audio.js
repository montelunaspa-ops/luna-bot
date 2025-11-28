// audio.js — Whisper para transcribir notas de voz
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribirAudio(url) {
  try {
    const response = await openai.audio.transcriptions.create({
      file_url: url,
      model: "gpt-4o-mini-tts"
    });

    return response.text || "";
  } catch (e) {
    console.log("❌ Error transcribiendo audio:", e);
    return "";
  }
}
