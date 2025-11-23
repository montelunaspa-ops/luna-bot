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

// ✅ Endpoint de prueba para verificar que el servidor está activo
app.get("/", (req, res) => {
  res.send("Servidor Luna funcionando ✅");
});

// ✅ Endpoint principal para WhatsApp / WhatAuto
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
      cliente = insert.data[0];
    }

    // 2️⃣ Convertir nota de voz a texto si aplica
    let textoMensaje = message;
    if (type === "voice" && mediaUrl) {
      textoMensaje = await transcribirAudio(mediaUrl);
    }

    // 3️⃣ Obtener historial del cliente
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    // 4️⃣ Generar prompt dinámico para GPT
    const prompt = generarPrompt(historial || [], textoMensaje, cliente);

    // 5️⃣ Llamar a OpenAI GPT-4o-mini de manera segura
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres Luna, asistente virtual de Delicias Monte Luna. Sigue el flujo de ventas de forma fluida y persuasiva. Responde como un vendedor humano y toma pedidos respetando el flujo completo de catálogo, sabores, porciones, cantidades, despacho y resumen final."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    const respuestaLuna = gptResponse.choices?.[0]?.message?.content;

    // Manejo seguro si la IA no devuelve respuesta
    if (!respuestaLuna) {
      res.json({
        reply:
          "Lo siento, no pude procesar tu mensaje correctamente. Intenta nuevamente."
      });
      return;
    }

    // 6️⃣ Guardar historial en Supabase
    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuestaLuna
    });

    // 7️⃣ Responder a WhatsApp / WhatAuto
    res.json({ reply: respuestaLuna });
  } catch (error) {
    console.error("Error en /whatsapp:", error);
    res.status(500).json({
      reply:
        "Lo siento, ocurrió un error en el servidor. Por favor intenta nuevamente."
    });
  }
});

// ✅ Puerto dinámico para Render
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`
