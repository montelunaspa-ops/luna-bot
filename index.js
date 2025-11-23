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

// Endpoint de prueba
app.get("/", (req, res) => {
  res.send("Servidor Luna funcionando ✅");
});

// Endpoint principal para WhatAuto
app.post("/whatsapp", async (req, res) => {
  try {
    const { from, message, type, mediaUrl } = req.body;

    // 1️⃣ Verificar si el cliente existe
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
      cliente = insert.data?.[0] || { whatsapp: from };
    }

    // 2️⃣ Convertir nota de voz a texto si aplica
    let textoMensaje = message;
    if (type === "voice" && mediaUrl) {
      try {
        textoMensaje = await transcribirAudio(mediaUrl);
      } catch (e) {
        console.error("Error transcribiendo audio:", e);
        textoMensaje = "[Nota de voz no entendida]";
      }
    }

    // 3️⃣ Obtener historial del cliente
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    // 4️⃣ Generar prompt dinámico para GPT
    const prompt = generarPrompt(historial || [], textoMensaje, cliente);

    // 5️⃣ Llamar a GPT de manera segura
    let respuestaLuna = "";
    try {
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres Luna, asistente virtual de Delicias Monte Luna. Sigue el flujo de ventas completo de forma fluida y humana. Siempre envía preguntas sobre sabores, porciones, dirección y contacto. Termina con resumen del pedido y costo de despacho."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      });

      respuestaLuna = gptResponse.choices?.[0]?.message?.content;
    } catch (e) {
      console.error("Error GPT:", e);
      respuestaLuna =
        "Lo siento, no pude generar tu respuesta en este momento. Intenta nuevamente.";
    }

    // 6️⃣ Guardar historial
    try {
      await supabase.from("historial").insert({
        whatsapp: from,
        mensaje_cliente: textoMensaje,
        respuesta_luna: respuestaLuna
      });
    } catch (e) {
      console.error("Error guardando historial:", e);
    }

    // 7️⃣ Responder siempre con 'reply'
    if (!respuestaLuna) {
      respuestaLuna =
        "Lo siento, no pude procesar tu mensaje. Intenta nuevamente.";
    }

    res.json({ reply: respuestaLuna });
  } catch (error) {
    console.error("Error en /whatsapp:", error);
    res.json({
      reply:
        "Lo siento, ocurrió un error en el servidor. Intenta nuevamente más tarde."
    });
  }
});

// Puerto dinámico para Render
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
