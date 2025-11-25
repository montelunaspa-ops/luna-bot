// index.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { generarPrompt } from "./prompts.js";
import { transcribirAudio } from "./utils.js";
import { obtenerReglas } from "./lunaRules.js";

import OpenAI from "openai";

const app = express();

// Soportar JSON y x-www-form-urlencoded (WhatsAuto usa form-urlencoded)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ============================================================
   🔹 DETECTAR CONFIRMACIÓN DE PEDIDO
============================================================ */
function clienteConfirmoPedido(texto) {
  if (!texto || typeof texto !== "string") return false;
  const t = texto.toLowerCase();
  return (
    t.includes("confirmo") ||
    t.includes("sí confirmo") ||
    t.includes("si confirmo") ||
    t.includes("acepto") ||
    t.includes("confirmado") ||
    t.includes("confirmar pedido")
  );
}

/* ============================================================
   🔹 ENDPOINT DE PRUEBA
============================================================ */
app.get("/", (req, res) => {
  res.send("Servidor Luna funcionando correctamente ✨");
});

/* ============================================================
   🔹 ENDPOINT PRINCIPAL /whatsapp (WhatsAuto → Render)
============================================================ */
app.post("/whatsapp", async (req, res) => {
  console.log("📩 Nueva petición /whatsapp:");
  console.log("Body recibido:", req.body);

  try {
    // WhatsAuto suele enviar: app, sender, phone, message
    const { phone, message, type, mediaUrl } = req.body;

    const from = phone || req.body.from || req.body.sender || null;

    if (!from) {
      console.warn("⚠ Petición sin número de teléfono válido.");
      return res.json({
        reply: "No pude identificar tu número de contacto. Intenta nuevamente por favor. 💛"
      });
    }

    let textoMensaje = message || "";

    // Si no hay texto ni media → respuesta genérica
    if (!textoMensaje && !mediaUrl) {
      console.log("⚠ Mensaje vacío, respondiendo ayuda básica.");
      return res.json({
        reply: "¡Hola! Soy Luna 💛, puedo ayudarte a tomar tu pedido de Delicias Monte Luna. Escríbeme qué te gustaría saber o pedir."
      });
    }

    // 1️⃣ Si viene una nota de voz, la transcribimos
    let tipoMensaje = type || "text";
    if (tipoMensaje === "voice" && mediaUrl) {
      try {
        console.log("[FLOW] Mensaje de voz recibido, iniciando transcripción...");
        textoMensaje = await transcribirAudio(mediaUrl);
      } catch (err) {
        console.error("[FLOW] Error al transcribir audio:", err);
        textoMensaje = "[Nota de voz no entendida]";
      }
    }

    console.log("[FLOW] Texto interpretado del cliente:", textoMensaje);

    // 2️⃣ Buscar o crear cliente
    let { data: cliente, error: errCliente } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("whatsapp", from)
      .maybeSingle();

    if (errCliente) {
      console.error("[DB] Error buscando cliente:", errCliente.message);
    }

    let clienteNuevo = false;
    if (!cliente) {
      console.log("[DB] Cliente nuevo, creando registro...");
      const { data: nuevo, error: errInsert } = await supabase
        .from("clientes_detallados")
        .insert({ whatsapp: from })
        .select()
        .maybeSingle();

      if (errInsert) {
        console.error("[DB] Error creando cliente:", errInsert.message);
        // Aun así, seguimos con un objeto básico
        cliente = { whatsapp: from };
      } else {
        cliente = nuevo;
        clienteNuevo = true;
      }
    } else {
      console.log("[DB] Cliente existente encontrado, id:", cliente.id || cliente.whatsapp);
    }

    // 3️⃣ Confirmación de pedido → responde solo ✅ y crea pedido
    if (clienteConfirmoPedido(textoMensaje)) {
      console.log("[FLOW] Cliente confirmó pedido. Registrando en 'pedidos'...");

      try {
        await supabase.from("pedidos").insert({
          whatsapp: from,
          confirmado: true,
          // Opcional: podrías guardar textoMensaje en un campo "nota_confirmacion"
          nota_confirmacion: textoMensaje
        });
      } catch (e) {
        console.error("[DB] Error insertando pedido confirmado:", e);
      }

      // Último mensaje: solo el check verde
      return res.json({ reply: "✅" });
    }

    // 4️⃣ Cargar reglas desde tabla
    const reglas = await obtenerReglas();
    console.log("[FLOW] Reglas cargadas (primeros 80 caracteres):", reglas.slice(0, 80) + "...");

    // 5️⃣ Historial del cliente
    const { data: historial, error: errHist } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from)
      .order("id", { ascending: true });

    if (errHist) {
      console.error("[DB] Error leyendo historial:", errHist.message);
    } else {
      console.log("[DB] Historial recuperado, cantidad mensajes:", historial?.length || 0);
    }

    // 6️⃣ Mensaje de bienvenida SOLO para clientes nuevos
    if (clienteNuevo) {
      console.log("[FLOW] Cliente nuevo → enviando catálogo de bienvenida.");

      const bienvenida = `
¡Hola! Soy Luna, asistente virtual de Delicias Monte Luna 🌙✨
Te comparto nuestro catálogo y luego te ayudo a hacer tu pedido.

(Puedes escribir en cualquier momento qué te gustaría pedir o preguntar.)

${reglas}
      
¿Qué deseas pedir hoy? 💛
      `.trim();

      try {
        await supabase.from("historial").insert({
          whatsapp: from,
          mensaje_cliente: textoMensaje,
          respuesta_luna: bienvenida
        });
      } catch (e) {
        console.error("[DB] Error guardando historial de bienvenida:", e);
      }

      return res.json({ reply: bienvenida });
    }

    // 7️⃣ Construir prompt y llamar a GPT para respuesta normal
    console.log("[FLOW] Construyendo prompt para GPT...");
    const prompt = generarPrompt(historial || [], textoMensaje, cliente, reglas);

    console.log("[OPENAI] Solicitando respuesta a gpt-4o-mini...");
    let respuestaLuna = "";
    try {
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres Luna, asistente virtual de Delicias Monte Luna. Responde SOLO usando la información del negocio que está en las reglas internas. Sé amable, clara y guía al cliente hacia el cierre del pedido."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      });

      respuestaLuna = gptResponse.choices?.[0]?.message?.content || "";
      console.log("[OPENAI] Respuesta generada (primeros 80 caracteres):", respuestaLuna.slice(0, 80) + "...");
    } catch (err) {
      console.error("[OPENAI] Error generando respuesta:", err);
      respuestaLuna =
        "Hubo un problema al generar tu respuesta 💛, por favor intenta nuevamente en unos momentos.";
    }

    // 8️⃣ Guardar en historial
    try {
      await supabase.from("historial").insert({
        whatsapp: from,
        mensaje_cliente: textoMensaje,
        respuesta_luna: respuestaLuna
      });
      console.log("[DB] Historial actualizado correctamente.");
    } catch (e) {
      console.error("[DB] Error guardando historial:", e);
    }

    // 9️⃣ Responder al cliente
    if (!respuestaLuna || !respuestaLuna.trim()) {
      respuestaLuna = "No pude procesar bien tu mensaje 💛, ¿podrías repetirlo de otra forma?";
    }

    return res.json({ reply: respuestaLuna });
  } catch (e) {
    console.error("❌ Error inesperado en /whatsapp:", e);
    return res.json({
      reply: "Ocurrió un error interno en el servidor. Intenta nuevamente en unos minutos 💛"
    });
  }
});

/* ============================================================
   🔹 PUERTO
============================================================ */
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor Luna arriba en puerto ${PORT}`));
