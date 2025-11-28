// ===============================================
//  Luna Bot - Delicias Monte Luna
//  index.js (versión final con logs y 100% funcional)
// ===============================================

import express from "express";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import { obtenerReglas } from "./lunaRules.js";
import { normalizar } from "./normalize.js";
import { responderGPT } from "./gpt.js";
import { procesarAudio } from "./audio.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "20mb" }));

// === DEBUG ===
const DEBUG = true;
const log = (...msg) => DEBUG && console.log("[LUNA DEBUG]", ...msg);

// ===============================================
// RUTA DE PRUEBA
// ===============================================
app.get("/", (req, res) => {
  res.send("Luna Bot funciona ✔️ (modo debug)");
});

// ===============================================
// EXTRAER MENSAJE
// ===============================================
function extraerMensaje(body) {
  return body?.message || body?.text || body?.mensaje || "";
}

// ===============================================
// GUARDAR HISTORIAL
// ===============================================
async function guardarHistorial(telefono, mensaje, respuesta) {
  try {
    const { error } = await supabase.from("historial").insert({
      telefono,
      mensaje_usuario: mensaje,
      respuesta_bot: respuesta
    });

    if (error) log("❌ Error guardando historial:", error);
    else log("✔ Historial guardado");
  } catch (error) {
    log("❌ Excepción guardando historial:", error);
  }
}

// ===============================================
// OBTENER HISTORIAL
// ===============================================
async function obtenerHistorial(telefono) {
  try {
    const { data, error } = await supabase
      .from("historial")
      .select("*")
      .eq("telefono", telefono)
      .order("fecha", { ascending: true });

    if (error) {
      log("❌ Error obteniendo historial:", error);
      return [];
    }

    log("📜 Historial obtenido:", data);
    return data || [];

  } catch (e) {
    log("❌ Excepción historial:", e);
    return [];
  }
}

// ===============================================
// VERIFICAR CLIENTE
// ===============================================
async function verificarCliente(telefono) {
  const { data } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("telefono", telefono)
    .maybeSingle();

  return data;
}

// ===============================================
// REGISTRAR CLIENTE
// ===============================================
async function registrarCliente(telefono) {
  await supabase.from("clientes_detallados").insert({
    telefono,
    es_cliente: false
  });
}

// ===============================================
// WEBHOOK PRINCIPAL
// ===============================================
app.post("/whatsapp", async (req, res) => {
  try {
    log("===========================================");
    log("📥 Nuevo mensaje recibido");
    log("Payload:", req.body);

    const telefono = req.body.from;

    // --- EXTRAER TEXTO O TRANSCRIBIR AUDIO ---
    let mensajeOriginal = extraerMensaje(req.body);
    log("👉 Texto recibido:", mensajeOriginal);

    if (req.body?.audio) {
      log("🎤 Audio detectado. Transcribiendo...");
      const texto = await procesarAudio(req.body.audio);
      log("📝 Transcripción:", texto);
      if (texto) mensajeOriginal = texto;
    }

    const mensajeNormalizado = normalizar(mensajeOriginal);
    log("🔤 Texto normalizado:", mensajeNormalizado);

    // --- CARGAR REGLAS ---
    log("📚 Cargando reglas...");
    const reglas = await obtenerReglas();
    log("📘 Reglas cargadas:", reglas);

    // --- CLIENTE ---
    log("🔎 Verificando cliente:", telefono);
    let cliente = await verificarCliente(telefono);

    if (!cliente) {
      log("➕ Cliente nuevo. Registrando...");
      await registrarCliente(telefono);
      cliente = { telefono };
    } else {
      log("✔ Cliente existente:", cliente);
    }

    // --- HISTORIAL ---
    log("📜 Obteniendo historial...");
    const historial = await obtenerHistorial(telefono);

    // --- GPT-4O ---
    log("🤖 Enviando todo a GPT-4o...");
    const respuesta = await responderGPT({
      mensajeOriginal,
      mensajeNormalizado,
      reglas,
      historial,
      cliente
    });

    log("🤖 Respuesta GPT:", respuesta);

    // --- GUARDAR HISTORIAL ---
    await guardarHistorial(telefono, mensajeOriginal, respuesta);

    // --- RESPONDER ---
    return res.json({ reply: respuesta });

  } catch (error) {
    log("❌ ERROR GLOBAL:", error);
    return res.json({
      reply: "Lo siento, ocurrió un error inesperado 😓"
    });
  }
});

// ===============================================
// INICIAR SERVIDOR
// ===============================================
app.listen(process.env.PORT || 3000, () => {
  log("🚀 Luna Bot activo en puerto", process.env.PORT || 3000);
});
