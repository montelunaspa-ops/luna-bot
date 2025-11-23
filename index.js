import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { generarPrompt } from "./prompts.js";
import { transcribirAudio, validarComuna } from "./utils.js";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Endpoint de prueba para verificar que el servidor está activo
app.get("/", (req, res) => {
  res.send("Servidor Luna funcionando ✅");
});

// Endpoint principal para WhatsApp
app.post("/whatsapp", async (req, res) => {
  try {
    const { from, message, type, mediaUrl } = req.body;

    // 1️⃣ Verificar cliente
    let { data: cliente } = await supabase
      .from("clientes")
      .select("*")
      .eq("whatsapp", from)
      .single();

    if (!cliente) {
      const insert = await supabase
        .from("clientes")
        .insert({ whatsapp: from })
        .select();
      cliente = insert.data[0];
    }

    // 2️⃣ Convertir nota de voz a texto si aplica
    let textoMensaje = message;
    if (type === "voice" && mediaUrl) {
      textoMensaje = await transcribirAudio(mediaUrl);
    }

    // 3️⃣ Obtener historial
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    // 4️⃣ Generar prompt para IA
    const prompt = generarPrompt(historial || [], textoMensaje, cliente);

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const respuestaLuna = gptResponse.choices[0].message.content;

    // 5️⃣ Guardar historial
    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuestaLuna
    });

    // 6️⃣ Responder en formato WhatAuto
    res.json({ reply: respuestaLuna });

  } catch (error) {
    console.error("Error en /whatsapp:", error);
    res.status(500).json({ reply: "Lo siento, ocurrió un error en el servidor." });
  }
});

// 7️⃣ Puerto dinámico para Render
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
