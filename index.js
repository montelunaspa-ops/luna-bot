// ===============================================
//  Luna Bot - Delicias Monte Luna
//  index.js (versión PRO con detección flexible de comunas)
// ===============================================

import express from "express";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import { normalizar } from "./normalize.js";
import { obtenerReglas } from "./lunaRules.js";
import { responderGPT } from "./gpt.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "20mb" }));

// ==================================================
//   RUTA GET PARA PROBAR EN NAVEGADOR (Render ready)
// ==================================================
app.get("/", (req, res) => {
  res.send("Luna Bot está funcionando ✔️");
});

// ==================================================
//   EXTRAER MENSAJE DEL BODY (Whatauto compatible)
// ==================================================
function extraerMensaje(body) {
  if (body?.message) return body.message;
  if (body?.text) return body.text;
  if (body?.mensaje) return body.mensaje;
  return "";
}

// ==================================================
//   GUARDAR HISTORIAL
// ==================================================
async function guardarHistorial(telefono, mensaje, respuesta) {
  await supabase.from("historial").insert({
    telefono,
    mensaje_usuario: mensaje,
    respuesta_bot: respuesta,
  });
}

// ==================================================
//   OBTENER HISTORIAL
// ==================================================
async function obtenerHistorial(telefono) {
  const { data } = await supabase
    .from("historial")
    .select("mensaje_usuario, respuesta_bot, fecha")
    .eq("telefono", telefono)
    .order("fecha", { ascending: true });

  return data || [];
}

// ==================================================
//   VERIFICAR CLIENTE
// ==================================================
async function verificarCliente(telefono) {
  const { data } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("telefono", telefono)
    .maybeSingle();

  return data;
}

// ==================================================
//   REGISTRAR CLIENTE NUEVO
// ==================================================
async function registrarCliente(telefono) {
  await supabase.from("clientes_detallados").insert({
    telefono,
    es_cliente: false,
  });
}

// ==================================================
//   WEBHOOK PRINCIPAL
// ==================================================

app.post("/whatsapp", async (req, res) => {
  try {
    const telefono = req.body.from;
    const mensajeOriginal = extraerMensaje(req.body) || "";
    const mensajeNormalizado = normalizar(mensajeOriginal);

    // ------------------------------
    // 1️⃣ Cargar reglas desde BD
    // ------------------------------
    const reglas = await obtenerReglas();

    // ------------------------------
    // 2️⃣ Convertir comunas a lista flexible
    // ------------------------------
    const listaComunas = reglas.comunas_despacho
      .split(/\r?\n/) // separa por SALTOS DE LÍNEA
      .map(c =>
        normalizar(
          c
            .replace(/\(.*?\)/g, "")      // elimina texto entre paréntesis
            .replace(/[^\w\s]/gi, "")     // elimina símbolos
            .trim()
        )
      )
      .filter(c => c.length > 0);

    // ------------------------------
    // 3️⃣ Verificar cliente
    // ------------------------------
    let cliente = await verificarCliente(telefono);

    if (!cliente) {
      await registrarCliente(telefono);
      cliente = { telefono };
    }

    // ------------------------------
    // 4️⃣ Historial del cliente
    // ------------------------------
    const historial = await obtenerHistorial(telefono);

    // ------------------------------
    // 5️⃣ Contexto básico (GPT decide todo)
    // ------------------------------
    const contextoFlujo = {
      tieneComuna: false
    };

    // Detectamos si el último mensaje contiene una comuna válida
    if (listaComunas.some(c => mensajeNormalizado.includes(c))) {
      contextoFlujo.tieneComuna = true;
    }

    // ------------------------------
    // 6️⃣ GPT: Motor inteligente
    // ------------------------------
    const respuesta = await responderGPT(
      mensajeNormalizado,
      cliente,
      historial,
      contextoFlujo,
      listaComunas
    );

    // ------------------------------
    // 7️⃣ Guardar historial
    // ------------------------------
    await guardarHistorial(telefono, mensajeOriginal, respuesta);

    // ------------------------------
    // 8️⃣ Responder a Whatauto
    // ------------------------------
    return res.json({
      reply: respuesta
    });

  } catch (error) {
    console.error("Error en /whatsapp:", error);
    return res.json({ reply: "Lo siento, hubo un error inesperado 😓" });
  }
});

// ==================================================
//   INICIAR SERVIDOR
// ==================================================
app.listen(process.env.PORT || 3000, () => {
  console.log("Luna Bot activo en el puerto:", process.env.PORT || 3000);
});
