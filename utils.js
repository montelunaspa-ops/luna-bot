import OpenAI from "openai";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function transcribirAudio(mediaUrl) {
  console.log("🎤 Descargando nota de voz…");

  const response = await fetch(mediaUrl);
  const buffer = Buffer.from(await response.arrayBuffer());

  const tmp = path.join("/tmp", "voz.mp3");
  fs.writeFileSync(tmp, buffer);

  const transcript = await openai.audio.transcriptions.create({
    file: fs.createReadStream(tmp),
    model: "whisper-1"
  });

  fs.unlinkSync(tmp);

  console.log("📝 Transcripción:", transcript.text);

  return transcript.text;
}
