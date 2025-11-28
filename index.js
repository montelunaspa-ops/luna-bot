// ===============================================
//  Luna Bot - Delicias Monte Luna
//  index.js (GPT-4o controla TODO)
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
  await supabase.from("historial").insert({
    telefono,
    mensaje_usuario: mensaje,
    respuesta_bot: respuesta
  });
}

// ===============================================
// Obtener historial
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
// Registrar cliente nuevo
// ===============================================
async function registrarCliente(telefono) {
  await supabase.from("clientes_detallados").insert({
    telefono,
    es_cliente: false
  });
}

// ===============================================
// Verificar cliente existente
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
//   WEBHOOK PRINCIPAL
// ===============================================
app.post("/whatsapp", async (req, res) => {
  try {
    const telefono = req.body.from;

    // ⬇️ mensaje inicial
    let mensajeOriginal = extraerMensaje(req.body);

    // ⬇️ si viene audio, transcribirlo con GPT-4o
    if (req.body?.audio) {
      const texto = await procesarAudio(req.body.audio);
      if (texto) mensajeOriginal = texto;
    }

    const mensajeNormalizado = normalizar(mensajeOriginal);

    // ⬇️ cargar reglas
    const reglas = await obtenerReglas();

    // ⬇️ cliente
    let cliente = await verificarCliente(telefono);
    if (!cliente) {
      await registrarCliente(telefono);
      cliente = { telefono };
    }

    // ⬇️ historial completo
    const historial = await obtenerHistorial(telefono);

    // ⬇️ GPT-4o responde TODO
    const respuesta = await responderGPT({
      mensajeOriginal,
      mensajeNormalizado,
      reglas,
      historial,
      cliente
    });

    // ⬇️ guardar historial
    await guardarHistorial(telefono, mensajeOriginal, respuesta);

    return res.json({ reply: respuesta });

  } catch (error) {
    console.error("❌ Error en /whatsapp:", error);
    return res.json({ reply: "Lo siento, ocurrió un error inesperado 😓" });
  }
});

// ===============================================
//   INICIAR SERVIDOR
// ===============================================
app.listen(process.env.PORT || 3000, () => {
  console.log("✔ Luna Bot activo en puerto", process.env.PORT || 3000);
});
