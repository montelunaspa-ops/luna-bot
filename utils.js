import OpenAI from "openai";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Convierte nota de voz a texto usando Whisper
export async function transcribirAudio(urlAudio) {
  const response = await openai.audio.transcriptions.create({
    file: await axios.get(urlAudio, { responseType: "arraybuffer" }),
    model: "whisper-1"
  });
  return response.text;
}
