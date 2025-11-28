import express from "express";
import dotenv from "dotenv";
import { supabase } from "./supabaseClient.js";
import { obtenerReglas } from "./lunaRules.js";
import { normalizar } from "./normalize.js";
import { procesarAudio } from "./audio.js";
import { responderGPT } from "./gpt.js";

dotenv.config();

const app = express();
const DEBUG = true;
const log = (...a) => DEBUG && console.log("[LUNA DEBUG]", ...a);

// WhatsAuto envía TEXT + URLENCODED
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: "*/*" }));
app.use(express.json());

// BD auxiliares
async function obtenerHistorial(telefono) {
  const { data } = await supabase
    .from("historial")
    .select("*")
    .eq("telefono", telefono)
    .order("fecha", { ascending: true });

  return data || [];
}

async function guardarHistorial(telefono, msg, bot) {
  await supabase.from("historial").insert({
    telefono,
    mensaje_usuario: msg,
    respuesta_bot: bot
  });
}

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

app.post("/whatsapp", async (req, res) => {
  try {
    log("========================================");
    log("📩 RAW BODY:", req.body);

    let phone = "";
    let message = "";
    let type = "";
    let mediaUrl = "";

    // Caso A → WHATAUTO envía como texto URLENCODED
    if (typeof req.body === "string") {
      const params = new URLSearchParams(req.body);
      phone = decodeURIComponent(params.get("phone") || "");
      message = decodeURIComponent(params.get("message") || "");
      type = decodeURIComponent(params.get("type") || "");
      mediaUrl = decodeURIComponent(params.get("mediaUrl") || "");
    }

    // Caso B → JSON
    if (typeof req.body === "object") {
      phone = req.body.phone || phone;
      message = req.body.message || message;
      type = req.body.type || type;
      mediaUrl = req.body.mediaUrl || mediaUrl;
    }

    log("👉 phone:", phone);
    log("👉 message:", message);
    log("👉 type:", type);
    log("👉 mediaUrl:", mediaUrl);

    if (!phone) {
      return res.json({ reply: "No pude identificar tu número 😓" });
    }

    // Procesar notas de voz
    if (type === "voice" && mediaUrl) {
      message = await procesarAudio(mediaUrl);
      log("🎤 Texto transcrito:", message);
    }

    const mensajeNormalizado = normalizar(message);
    const reglas = await obtenerReglas();
    let cliente = await verificarCliente(phone);

    if (!cliente) {
      await registrarCliente(phone);
      cliente = { telefono: phone };
    }

    const historial = await obtenerHistorial(phone);

    const respuesta = await responderGPT({
      mensajeOriginal: message,
      mensajeNormalizado,
      reglas,
      historial,
      cliente
    });

    await guardarHistorial(phone, message, respuesta);

    return res.json({ reply: respuesta });

  } catch (e) {
    log("❌ ERROR GLOBAL:", e);
    return res.json({
      reply: "Ocurrió un error inesperado 😓"
    });
  }
});

app.get("/", (req, res) => res.send("Luna bot funcionando ✔️"));

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Luna Bot activo en puerto", process.env.PORT || 3000);
});
