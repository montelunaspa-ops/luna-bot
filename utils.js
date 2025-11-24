import OpenAI from "openai";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Función para transcribir audio
export async function transcribirAudio(mediaUrl) {
  const response = await fetch(mediaUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  const tmpPath = path.join("/tmp", "voz.mp3");
  fs.writeFileSync(tmpPath, buffer);

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(tmpPath),
    model: "whisper-1"
  });

  fs.unlinkSync(tmpPath);
  return transcription.text;
}
