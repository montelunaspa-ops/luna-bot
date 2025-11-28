// ======================================================
// Luna Bot - Compatible 100% con WhatsAuto
// GPT-4o controla todo el flujo, sin loops
// ======================================================

import express from "express";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import { obtenerReglas } from "./lunaRules.js";
import { normalizar } from "./normalize.js";
import { responderGPT } from "./gpt.js";
import { procesarAudio } from "./audio.js";

dotenv.config();

const app = express();
// ===============================
// 🔬 TEST DE DIAGNÓSTICO
// CAPTURA TODO EL BODY TAL COMO LLEGA
// ===============================
app.use(express.text({ type: "*/*" }));

app.use((req, res, next) => {
  console.log("🧪 RAW BODY RECIBIDO (TEXTO):", req.body);
  next();
});

app.use(express.json({ limit: "20mb" }));

const DEBUG = true;
const log = (...a) => DEBUG && console.log("[LUNA DEBUG]", ...a);

// ======================================================
// Función para guardar historial
// ======================================================
async function guardarHistorial(telefono, mensaje, respuesta) {
  try {
    await supabase.from("historial").insert({
      telefono,
      mensaje_usuario: mensaje,
      respuesta_bot: respuesta
    });
    log("✔ Historial guardado");
  } catch (error) {
    console.error("❌ Error guardando historial:", error);
  }
}

// ======================================================
// Obtener historial del cliente
// ======================================================
async function obtenerHistorial(telefono) {
  try {
    const { data } = await supabase
      .from("historial")
      .select("*")
      .eq("telefono", telefono)
      .order("fecha", { ascending: true });

    log("📜 Historial obtenido:", data);
    return data || [];
  } catch (error) {
    log("❌ Error historial:", error);
    return [];
  }
}

// ======================================================
// Verificar cliente
// ======================================================
async function verificarCliente(telefono) {
  const { data } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("telefono", telefono)
    .maybeSingle();

  return data;
}

// ======================================================
// Registrar cliente nuevo
// ======================================================
async function registrarCliente(telefono) {
  await supabase.from("clientes_detallados").insert({
    telefono,
    es_cliente: false
  });
}

// ======================================================
// RUTA PRINCIPAL – WHATS AUTO → BOT
// ======================================================
app.post("/whatsapp", async (req, res) => {
  try {
    log("========================================");
    log("📩 WHATS AUTO PAYLOAD:", req.body);

    // WhatsAuto envía:
    // {
    //   phone: "+56911111111",
    //   message: "Hola",
    //   type: "text" | "voice",
    //   mediaUrl: "https://audio.ogg"
    // }

    const { phone, message, type, mediaUrl } = req.body;

    if (!phone) {
      log("❌ ERROR: WhatsAuto NO envió el número del cliente.");
      return res.json({
        reply: "No pude identificar tu número. Intenta de nuevo por favor 🙏"
      });
    }

    log("👉 Teléfono:", phone);
    log("👉 Tipo:", type);
    log("👉 Mensaje:", message);

    // ===============================================
    // Convertir audio a texto
    // ===============================================
    let mensajeOriginal = message || "";

    if (type === "voice" && mediaUrl) {
      log("🎤 Nota de voz recibida. Transcribiendo:", mediaUrl);

      mensajeOriginal = await procesarAudio(mediaUrl);
      log("📝 Texto transcrito:", mensajeOriginal);
    }

    const mensajeNormalizado = normalizar(mensajeOriginal);

    // ===============================================
    // REGLAS DEL NEGOCIO
    // ===============================================
    const reglas = await obtenerReglas();
    log("📘 Reglas cargadas");

    // ===============================================
    // VERIFICAR CLIENTE
    // ===============================================
    let cliente = await verificarCliente(phone);

    if (!cliente) {
      log("➕ Nuevo cliente. Registrando:", phone);
      await registrarCliente(phone);
      cliente = { telefono: phone };
    } else {
      log("✔ Cliente encontrado");
    }

    // ===============================================
    // HISTORIAL DEL CLIENTE
    // ===============================================
    const historial = await obtenerHistorial(phone);

    // ===============================================
    // GPT-4o TOMA EL CONTROL COMPLETO
    // ===============================================
    log("🤖 Enviando a GPT-4o...");

    const respuesta = await responderGPT({
      mensajeOriginal,
      mensajeNormalizado,
      reglas,
      historial,
      cliente
    });

    log("🤖 Respuesta GPT:", respuesta);

    // ===============================================
    // GUARDAR HISTORIAL
    // ===============================================
    await guardarHistorial(phone, mensajeOriginal, respuesta);

    // ===============================================
    // RESPUESTA PARA WHATS AUTO
    // ===============================================
    return res.json({ reply: respuesta });

  } catch (error) {
    console.error("❌ ERROR GLOBAL:", error);
    return res.json({
      reply: "Lo siento, ocurrió un error inesperado 😓"
    });
  }
});

// ======================================================
// INICIAR SERVIDOR
// ======================================================
app.get("/", (req, res) => res.send("Luna Bot Operativo ✔️"));

app.listen(process.env.PORT || 3000, () => {
  log("🚀 Servidor activo en puerto", process.env.PORT || 3000);
});
