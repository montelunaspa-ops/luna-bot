import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribirAudio(fileUrl) {
  try {
    const res = await openai.audio.transcriptions.create({
      file_url: fileUrl,
      model: "gpt-4o-mini-transcribe"
    });

    return res.text || "";
  } catch (e) {
    console.log("Error transcribiendo:", e);
    return "";
  }
}
