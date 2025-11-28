// ===============================================
//  Luna Bot - Delicias Monte Luna
//  index.js (versión definitiva y profesional)
// ===============================================

import express from "express";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import { normalizar } from "./normalize.js";
import { obtenerReglas } from "./lunaRules.js";
import { responderGPT } from "./gpt.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "10mb" }));

// Ruta GET opcional para verificar que Render está arriba
app.get("/", (req, res) => {
  res.send("Luna Bot está funcionando ✔️");
});

// ===============================================
//   EXTRAE MENSAJE DE WHATAUTO
// ===============================================
function extraerMensaje(body) {
  if (body?.message) return body.message;
  if (body?.text) return body.text;
  if (body?.mensaje) return body.mensaje;
  return "";
}

// ===============================================
//   GUARDAR EN HISTORIAL
// ===============================================
async function guardarHistorial(telefono, mensaje, respuesta) {
  await supabase.from("historial").insert({
    telefono,
    mensaje_usuario: mensaje,
    respuesta_bot: respuesta,
  });
}

// ===============================================
//   OBTENER HISTORIAL DEL CLIENTE
// ===============================================
async function obtenerHistorial(telefono) {
  const { data } = await supabase
    .from("historial")
    .select("mensaje_usuario, respuesta_bot, fecha")
    .eq("telefono", telefono)
    .order("fecha", { ascending: true });

  return data || [];
}

// ===============================================
//   VERIFICAR SI EL CLIENTE EXISTE
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
//   REGISTRAR NUEVO CLIENTE
// ===============================================
async function registrarCliente(telefono) {
  await supabase.from("clientes_detallados").insert({
    telefono,
    es_cliente: false,
  });
}

// ===============================================
//   WEBHOOK PRINCIPAL
// ===============================================

app.post("/whatsapp", async (req, res) => {
  try {
    const telefono = req.body.from;
    let mensaje = extraerMensaje(req.body) || "";

    const mensajeNormalizado = normalizar(mensaje);

    // Cargar reglas de BD
    const reglas = await obtenerReglas();

    // Verificar cliente
    let cliente = await verificarCliente(telefono);

    if (!cliente) {
      await registrarCliente(telefono);
      cliente = { telefono };
    }

    // Obtener historial del cliente
    const historial = await obtenerHistorial(telefono);

    // Estado conversacional mínimo (GPT hará el resto)
    const contextoFlujo = {
      tieneComuna: false,
      tieneProducto: false,
      tieneCantidad: false,
      tieneFecha: false,
      tieneDireccion: false,
      tieneNombre: false,
    };

    // Mandar todo a GPT para respuesta inteligente
    const respuesta = await responderGPT(
      mensajeNormalizado,
      cliente,
      historial,
      contextoFlujo
    );

    // Guardar en historial
    await guardarHistorial(telefono, mensaje, respuesta);

    // Responder a Whatauto (solo texto)
    return res.json({
      reply: respuesta,
    });

  } catch (err) {
    console.error("Error en /whatsapp:", err);
    return res.json({ reply: "Lo siento, hubo un error inesperado." });
  }
});

// ===============================================
//   INICIAR SERVIDOR
// ===============================================
app.listen(process.env.PORT || 3000, () => {
  console.log("Luna Bot está activo en el puerto", process.env.PORT || 3000);
});
