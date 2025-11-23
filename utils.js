import fetch from "node-fetch";
import OpenAI from "openai";

/**
 * Transcribe un audio desde una URL usando Whisper.
 * @param {string} mediaUrl
 * @returns {Promise<string>}
 */
export async function transcribirAudio(mediaUrl) {
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) throw new Error("No se pudo descargar el audio");
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      file: buffer,
      model: "whisper-1",
    });

    return transcription.text;
  } catch (error) {
    console.error("Error transcribiendo audio:", error);
    return "[Nota de voz no entendida]";
  }
}
