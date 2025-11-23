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

// Endpoint principal
app.post("/whatsapp", async (req, res) => {
  try {
    const { from, message, type, mediaUrl } = req.body;

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

    let textoMensaje = message;
    if (type === "voice" && mediaUrl) {
      textoMensaje = await transcribirAudio(mediaUrl);
    }

    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    const prompt = generarPrompt(historial || [], textoMensaje, cliente);

    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres Luna, asistente virtual de Delicias Monte Luna. Sigue el flujo de ventas de forma fluida y persuasiva."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    const respuestaLuna = gptResponse.choices?.[0]?.message?.content;

    if (!respuestaLuna) {
      res.json({
        reply:
          "Lo siento, no pude procesar tu mensaje correctamente. Intenta nuevamente."
      });
      return;
    }

    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuestaLuna
    });

    res.json({ reply: respuestaLuna });
  } catch (error) {
    console.error("Error en /whatsapp:", error);
    res.status(500).json({
      reply:
        "Lo siento, ocurrió un error en el servidor. Por favor intenta nuevamente."
    });
  }
});

// Puerto dinámico
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
