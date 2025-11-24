import fs from "fs";
import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribirAudio(url) {
  const response = await fetch(url);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync("temp_audio.ogg", buffer);
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream("temp_audio.ogg"),
    model: "whisper-1"
  });
  fs.unlinkSync("temp_audio.ogg");
  return transcription.text;
}
