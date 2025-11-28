import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function procesarAudio(mediaUrl) {
  try {
    const transcription = await openai.chat.completions.create({
      model: "gpt-4o-audio-transcribe",
      audio_url: mediaUrl
    });

    return transcription.text || "";
  } catch (error) {
    console.error("❌ Error transcribiendo audio:", error);
    return "";
  }
}
