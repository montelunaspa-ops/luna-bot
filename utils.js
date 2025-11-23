import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import fetch from "node-fetch";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribirAudio(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  const tempFile = "./temp_audio.ogg";
  fs.writeFileSync(tempFile, Buffer.from(buffer));

  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream(tempFile),
    model: "whisper-1"
  });

  fs.unlinkSync(tempFile);
  return transcription.text;
}
