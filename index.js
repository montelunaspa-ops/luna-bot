import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { generarPrompt } from "./prompts.js";
import { transcribirAudio } from "./utils.js";
import { obtenerReglasDesdeDB } from "./lunaRules.js";  // ✅ CORREGIDO
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -----------------------------------------------------
   🧠 FUNCIÓN: GPT con reglas externas
----------------------------------------------------- */
async function responderConGPT(texto, cliente, historial = []) {
  console.log("🔎 Enviando mensaje a GPT…");

  const reglas = await obtenerReglasDesdeDB();  // ✅ CORREGIDO
  const prompt = generarPrompt(historial, texto, cliente, reglas);

  try {
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: reglas },
        { role: "user", content: prompt }
      ],
      temperature: 0.75
    });

    return gptResponse.choices?.[0]?.messa
