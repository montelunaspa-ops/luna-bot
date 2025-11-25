import OpenAI from "openai";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribirAudio(mediaUrl) {
  console.log("🎤 Descargando audio…");

  const response = await fetch(mediaUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  const tmpPath = path.join("/tmp", "voz.mp3");
  fs.writeFileSync(tmpPath, buffer);

  console.log("🎧 Procesando audio con Whisper…");

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(tmpPath),
    model: "whisper-1"
  });

  fs.unlinkSync(tmpPath);

  console.log("📝 Transcripción obtenida:", transcription.text);

  return transcription.text;
}
