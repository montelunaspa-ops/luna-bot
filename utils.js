import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";
import path from "path";

export async function transcribirAudio(mediaUrl) {
  try {
    const response = await fetch(mediaUrl);
    const buffer = await response.arrayBuffer();
    const tmpFile = path.join("./temp", `${Date.now()}.mp3`);
    fs.writeFileSync(tmpFile, Buffer.from(buffer));

    // Transcripción simulada (puedes usar OpenAI Whisper aquí)
    const transcription = "Transcripción de la nota de voz";
    fs.unlinkSync(tmpFile);
    return transcription;
  } catch (e) {
    console.error("Error transcribiendo audio:", e);
    return "[Nota de voz no entendida]";
  }
}
