// index.js — versión final para Luna Bot
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { transcribirAudio } from "./audio.js";
import { responderGPT } from "./gpt.js";

const app = express();
app.use(bodyParser.json({ limit: "20mb" }));
app.use(bodyParser.urlencoded({ extended: true }));

/* -------------------------------------------------------
   📌 ENDPOINT PRINCIPAL WHATSAPP (WhatsAuto)
-------------------------------------------------------- */
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("📩 Mensaje recibido:", req.body);

    const { phone, message, type, mediaUrl } = req.body;

    if (!phone) {
      return res.json({ reply: "No pude leer tu número 💛 intenta nuevamente." });
    }

    let textoMensaje = message?.trim() || "";
    const from = phone;

    /* -------------------------------------------------------
       🎤 Si es una nota de voz → convertir a texto
    -------------------------------------------------------- */
    if (type === "voice" && mediaUrl) {
      console.log("🎙 Nota de voz detectada, transcribiendo…");
      try {
        textoMensaje = await transcribirAudio(mediaUrl);
        console.log("📝 Texto transcrito:", textoMensaje);
      } catch (err) {
        textoMensaje = "[audio no entendido]";
      }
    }

    /* -------------------------------------------------------
       👤 Buscar cliente o crear si es nuevo
    -------------------------------------------------------- */
    let { data: cliente } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("whatsapp", from)
      .single();

    let clienteNuevo = false;

    if (!cliente) {
      console.log("🆕 Cliente nuevo. Registrando…");
      const { data: nuevo, error: errInsert } = await supabase
        .from("clientes_detallados")
        .insert({ whatsapp: from })
        .select()
        .single();

      if (errInsert) {
        console.error("❌ Error al crear cliente:", errInsert);
        return res.json({ reply: "Hubo un error al registrarte 💛 intenta nuevamente." });
      }

      cliente = nuevo;
      clienteNuevo = true;
    }

    /* -------------------------------------------------------
       🧠 RESPUESTA GPT (maneja flujo y preguntas libres)
    -------------------------------------------------------- */
    const respuestaGPT = await responderGPT(textoMensaje, cliente);

    /* -------------------------------------------------------
       📝 Guardar historial
    -------------------------------------------------------- */
    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuestaGPT
    });

    /* -------------------------------------------------------
       📤 Enviar respuesta al cliente
    -------------------------------------------------------- */
    return res.json({ reply: respuestaGPT });
  } catch (error) {
    console.error("❌ Error general:", error);
    return res.json({
      reply: "Hubo un problema inesperado 💛 por favor intenta nuevamente."
    });
  }
});

/* -------------------------------------------------------
   SERVIDOR
-------------------------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Luna Bot listo y escuchando en puerto ${PORT}`)
);
