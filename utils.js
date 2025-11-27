import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribirAudio(mediaUrl) {
  try {
    const response = await openai.audio.transcriptions.create({
      file_url: mediaUrl,
      model: "gpt-4o-mini-transcribe"
    });

    return response.text || "";
  } catch (e) {
    console.error("❌ Error transcribiendo audio:", e);
    return "";
  }
}
