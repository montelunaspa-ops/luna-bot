// ===============================================
//  Luna Bot - Delicias Monte Luna
//  index.js (CON LOGS DEBUG COMPLETOS)
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

// ACTIVA LOGS GLOBALES
const DEBUG = true;

const log = (...args) => {
  if (DEBUG) console.log("[LUNA DEBUG]", ...args);
};

app.get("/", (req, res) => {
  res.send("Luna Bot funcionando ✔️ (modo debug activo)");
});

// -----------------------------------------------
// Extraer texto de Whatauto
// -----------------------------------------------
function extraerMensaje(body) {
  return body?.message || body?.text || body?.mensaje || "";
}

// -----------------------------------------------
// Guardar historial
// -----------------------------------------------
async function guardarHistorial(telefono, mensaje, respuesta) {
  try {
    const { error } = await supabase.from("historial").insert({
      telefono,
      mensaje_usuario: mensaje,
      respuesta_bot: respuesta
    });

    if (error) {
      log("❌ ERROR guardando historial:", error);
    } else {
      log("✔ Historial guardado:", telefono, mensaje, respuesta);
    }
  } catch (e) {
    log("❌ EXCEPCIÓN guardando historial:", e);
  }
}

// -----------------------------------------------
// Webhook principal
// -----------------------------------------------
app.post("/whatsapp", async (req, res) => {
  try {
    log("===========================================");
    log("📥 NUEVO MENSAJE RECIBIDO");
    log("Payload crudo:", req.body);

    const telefono = req.body.from;
    let mensajeOriginal = extraerMensaje(req.body);

    log("👉 Mensaje original detectado:", mensajeOriginal);

    // Audio
    if (req.body?.audio) {
      log("🎤 Nota de voz detectada, transcribiendo...");
      const texto = await procesarAudio(req.body.audio);
      log("📝 Transcripción:", texto);

      if (texto) mensajeOriginal = texto;
    }

    const mensajeNormalizado = normalizar(mensajeOriginal);
    log("🔤 Mensaje normalizado:", mensajeNormalizado);

    // REGISTRO CLIENTE
    log("🔎 Verificando cliente:", telefono);
    let cliente = await verificarCliente(telefono);

    if (!cliente) {
      log("➕ Cliente nuevo. Registrando...");
      await registrarCliente(telefono);
      cliente = { telefono };
    } else {
      log("✔ Cliente existente:", cliente);
    }

    // REGLAS
    log("📚 Cargando reglas...");
    const reglas = await obtenerReglas();
    log("📘 Reglas obtenidas:", reglas);

    // HISTORIAL
    log("📜 Obteniendo historial...");
    const historial = await obtenerHistorial(telefono);
    log("📜 Historial completo:", historial);

    // GPT-4o
    log("🤖 Enviando a GPT-4o...");
    const respuesta = await responderGPT({
      mensajeOriginal,
      mensajeNormalizado,
      reglas,
      historial,
      cliente
    });

    log("🤖 Respuesta GPT-4o:", respuesta);

    // GUARDAR HISTORIAL
    await guardarHistorial(telefono, mensajeOriginal, respuesta);

    // RESPONDER A WHATAUTO
    log("📤 Enviando respuesta final...");
    return res.json({ reply: respuesta });

  } catch (error) {
    log("❌ ERROR GLOBAL:", error);
    return res.json({ reply: "Lo siento, ocurrió un error inesperado 😓" });
  }
});

// -----------------------------------------------
// Cliente y auxiliar
// -----------------------------------------------

async function verificarCliente(telefono) {
  const { data } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("telefono", telefono)
    .maybeSingle();

  return data;
}

async function registrarCliente(telefono) {
  await supabase.from("clientes_detallados").insert({
    telefono,
    es_cliente: false
  });
}

// -----------------------------------------------
// INICIAR SERVIDOR
// -----------------------------------------------
app.listen(process.env.PORT || 3000, () => {
  log("🚀 Luna Bot activo en puerto", process.env.PORT || 3000);
});
