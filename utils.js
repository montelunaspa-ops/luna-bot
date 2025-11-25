// utils.js
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Transcribe una nota de voz desde una URL (WhatsAuto nos entrega mediaUrl)
export async function transcribirAudio(mediaUrl) {
  try {
    console.log("[AUDIO] Descargando audio desde:", mediaUrl);

    const response = await fetch(mediaUrl);
    if (!response.ok) {
      console.error("[AUDIO] Error HTTP al descargar audio:", response.status, response.statusText);
      throw new Error("No se pudo descargar el audio");
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const tmpPath = path.join("/tmp", `voz_${Date.now()}.mp3`);
    fs.writeFileSync(tmpPath, buffer);

    console.log("[AUDIO] Archivo guardado temporalmente en:", tmpPath);

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: "whisper-1"
    });

    fs.unlinkSync(tmpPath);
    console.log("[AUDIO] Transcripción completa:", transcription.text);

    return transcription.text;
  } catch (error) {
    console.error("[AUDIO] Error transcribiendo audio:", error);
    throw error;
  }
}
