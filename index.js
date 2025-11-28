// ===============================================
//  Luna Bot - Delicias Monte Luna
//  index.js (versión final para GPT-4o anti-loop)
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

// ===============================================
// Ruta de prueba
// ===============================================
app.get("/", (req, res) => {
  res.send("Luna Bot está funcionando ✔️");
});

// ===============================================
// Extraer texto enviado por Whatauto
// ===============================================
function extraerMensaje(body) {
  return (
    body?.message ||
    body?.text ||
    body?.mensaje ||
    ""
  );
}

// ===============================================
// Guardar historial
// ===============================================
async function guardarHistorial(telefono, mensaje, respuesta) {
  try {
    await supabase.from("historial").insert({
      telefono,
      mensaje_usuario: mensaje,
      respuesta_bot: respuesta
    });
  } catch (e) {
    console.error("❌ Error guardando historial:", e);
  }
}

// ===============================================
// Obtener historial completo
// ===============================================
async function obtenerHistorial(telefono) {
  const { data } = await supabase
    .from("historial")
    .select("*")
    .eq("telefono", telefono)
    .order("fecha", { ascending: true });

  return data || [];
}

// ===============================================
// Verificar cliente
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
// Registrar cliente nuevo
// ===============================================
async function registrarCliente(telefono) {
  try {
    await supabase.from("clientes_detallados").insert({
      telefono,
      es_cliente: false
    });
  } catch (e) {
    console.error("❌ Error registrando cliente:", e);
  }
}

// ===============================================
//  WEBHOOK PRINCIPAL
// ===============================================
app.post("/whatsapp", async (req, res) => {
  try {
    const telefono = req.body.from;

    // ==========================
    // EXTRAER TEXTO O TRANSCRIBIR AUDIO
    // ==========================
    let mensajeOriginal = extraerMensaje(req.body);

    if (req.body?.audio) {
      const texto = await procesarAudio(req.body.audio);
      if (texto) mensajeOriginal = texto;
    }

    const mensajeNormalizado = normalizar(mensajeOriginal);

    // ==========================
    // CARGAR REGLAS DESDE BD
    // ==========================
    const reglas = await obtenerReglas();

    // ==========================
    // VERIFICAR / REGISTRAR CLIENTE
    // ==========================
    let cliente = await verificarCliente(telefono);
    if (!cliente) {
      await registrarCliente(telefono);
      cliente = { telefono };
    }

    // ==========================
    // HISTORIAL COMPLETO
    // ==========================
    const historial = await obtenerHistorial(telefono);

    // ==========================
    // GPT-4o DECIDE ABSOLUTAMENTE TODO
    // ==========================
    const respuesta = await responderGPT({
      mensajeOriginal,
      mensajeNormalizado,
      reglas,
      historial,
      cliente
    });

    // ==========================
    // GUARDAR HISTORIAL
    // ==========================
    await guardarHistorial(telefono, mensajeOriginal, respuesta);

    // ==========================
    // RESPUESTA PARA WHATAUTO
    // ==========================
    return res.json({ reply: respuesta });

  } catch (error) {
    console.error("❌ Error en /whatsapp:", error);
    return res.json({
      reply: "Lo siento, ocurrió un error inesperado 😓"
    });
  }
});

// ===============================================
// INICIAR SERVIDOR
// ===============================================
app.listen(process.env.PORT || 3000, () => {
  console.log("✔ Luna Bot activo en puerto", process.env.PORT || 3000);
});
