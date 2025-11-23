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

// Función auxiliar para validar comuna
export function validarComuna(comuna) {
  const cobertura = {
    "Cerro Navia": "11–13 hrs",
    "Cerrillos": "11–13 hrs",
    "Conchalí": "12–14 hrs",
    "Estacion Central": "9–11 hrs",
    "Independencia": "11–14 hrs",
    "Lo Prado": "11–13 hrs",
    "Lo Espejo": "10–12 hrs",
    "Maipú": "10–12 hrs",
    "Pedro Aguirre Cerda": "10–12 hrs",
    "Pudahuel": "12–14 hrs",
    "Quinta Normal": "10–13 hrs",
    "Recoleta": "11–13 hrs",
    "Renca": "10–13 hrs",
    "Santiago Centro": "9–11 hrs",
    "San Miguel": "10–12 hrs",
    "San Joaquín": "10–12 hrs"
  };
  return cobertura[comuna] || null;
}
