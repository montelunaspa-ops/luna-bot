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

app.get("/", (req, res) => {
  res.send("Luna Bot está funcionando ✔️");
});

// Extraer texto del body Whatauto
function extraerMensaje(body) {
  return body?.message || body?.text || body?.mensaje || "";
}

// Guardar historial
async function guardarHistorial(telefono, mensaje, respuesta) {
  await supabase.from("historial").insert({
    telefono,
    mensaje_usuario: mensaje,
    respuesta_bot: respuesta
  });
}

// Obtener historial completo
async function obtenerHistorial(telefono) {
  const { data } = await supabase
    .from("historial")
    .select("*")
    .eq("telefono", telefono)
    .order("fecha", { ascending: true });

  return data || [];
}

// Registrar cliente nuevo
async function registrarCliente(telefono) {
  await supabase.from("clientes_detallados").insert({
    telefono,
    es_cliente: false
  });
}

// Verificar cliente
async function verificarCliente(telefono) {
  const { data } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("telefono", telefono)
    .maybeSingle();

  return data;
}

// ===============================================
//  WEBHOOK PRINCIPAL
// ===============================================

app.post("/whatsapp", async (req, res) => {
  try {
    const telefono = req.body.from;
    let mensajeOriginal = extraerMensaje(req.body);

    // Si viene audio → transcribir con GPT-4o
    if (req.body?.audio) {
      const texto = await procesarAudio(req.body.audio);
      if (texto && texto.length > 0) {
        mensajeOriginal = texto;
      }
    }

    const mensajeNormalizado = normalizar(mensajeOriginal);

    // Cargar reglas desde Supabase
    const reglas = await obtenerReglas();

    // Verificar cliente
    let cliente = await verificarCliente(telefono);
    if (!cliente) {
      await registrarCliente(telefono);
      cliente = { telefono };
    }

    // Historial para GPT
    const historial = await obtenerHistorial(telefono);

    // GPT decide absolutamente TODO
    const respuesta = await responderGPT({
      mensajeOriginal,
      mensajeNormalizado,
      reglas,
      historial,
      cliente
    });

    // Guardar en historial
    await guardarHistorial(telefono, mensajeOriginal, respuesta);

    // Responder a Whatauto
    return res.json({ reply: respuesta
