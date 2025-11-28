// ===============================================
//  Luna Bot - Delicias Monte Luna
//  index.js (GPT controla TODO)
// ===============================================

import express from "express";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import { obtenerReglas } from "./lunaRules.js";
import { normalizar } from "./normalize.js";
import { responderGPT } from "./gpt.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "20mb" }));

// Probar servidor
app.get("/", (req, res) => {
  res.send("Luna Bot está funcionando ✔️");
});

// Extraer mensaje Whatauto
function extraerMensaje(body) {
  return (
    body?.message ||
    body?.text ||
    body?.mensaje ||
    ""
  );
}

// Guardar historial
async function guardarHistorial(telefono, mensaje, respuesta) {
  await supabase.from("historial").insert({
    telefono,
    mensaje_usuario: mensaje,
    respuesta_bot: respuesta
  });
}

// Obtener historial
async function obtenerHistorial(telefono) {
  const { data } = await supabase
    .from("historial")
    .select("*")
    .eq("telefono", telefono)
    .order("fecha", { ascending: true });

  return data || [];
}

// Registrar cliente
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

// Webhook principal
app.post("/whatsapp", async (req, res) => {
  try {
    const telefono = req.body.from;
    const mensajeOriginal = extraerMensaje(req.body);
    const mensajeNormalizado = normalizar(mensajeOriginal);

    // Reglas desde Supabase
    const reglas = await obtenerReglas();

    // Cliente
    let cliente = await verificarCliente(telefono);
    if (!cliente) {
      await registrarCliente(telefono);
      cliente = { telefono };
    }

    // Historial completo
    const historial = await obtenerHistorial(telefono);

    // GPT decide TODO
    const respuesta = await responderGPT({
      mensajeOriginal,
      mensajeNormalizado,
      reglas,
      historial,
      cliente
    });

    // Guardar en historial
    await guardarHistorial(telefono, mensajeOriginal, respuesta);

    // Responder Whatauto
    return res.json({ reply: respuesta });

  } catch (error) {
    console.error("❌ Error en /whatsapp:", error);
    return res.json({ reply: "Lo siento, ocurrió un error inesperado 😓" });
  }
});

// Iniciar servidor
app.listen(process.env.PORT || 3000, () => {
  console.log("✔ Luna Bot activo en puerto", process.env.PORT || 3000);
});
