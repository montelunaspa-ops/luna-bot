import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { generarPrompt } from "./prompts.js";
import { transcribirAudio } from "./utils.js";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/whatsapp", async (req, res) => {
  try {
    const { from, message, type, mediaUrl } = req.body;

    // Revisar cliente en la DB
    let { data: cliente } = await supabase
      .from("clientes")
      .select("*")
      .eq("whatsapp", from)
      .single();

    if (!cliente) {
      await supabase.from("clientes").insert({ whatsapp: from });
    }

    // Convertir nota de voz a texto si aplica
    let textoMensaje = message;
    if (type === "voice" && mediaUrl) {
      textoMensaje = await transcribirAudio(mediaUrl);
    }

    // Obtener historial
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    // Generar respuesta GPT
    const prompt = generarPrompt(historial || [], textoMensaje);
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });
    const respuestaLuna = gptResponse.choices[0].message.content;

    // Guardar historial
    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuestaLuna
    });

    // Responder a WhatsApp
    res.json({ text: respuestaLuna });

  } catch (error) {
    console.error("Error en /whatsapp:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Servidor escuchando en puerto ${process.env.PORT}`);
});
