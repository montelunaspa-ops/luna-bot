// index.js — VERSIÓN FINAL, ESTABLE Y CORREGIDA

import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { transcribirAudio } from "./audio.js";
import { responderGPT } from "./gpt.js";
import rules from "./rules.js";
import {
  validarComuna,
  detectarProducto,
  calcularResumen
} from "./helpers.js";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ------------------------------------------------------
// HOME
// ------------------------------------------------------
app.get("/", (req, res) => {
  res.send("🚀 Luna Bot funcionando correctamente 💛");
});

// ------------------------------------------------------
// BOT WHATSAPP
// ------------------------------------------------------
app.post("/whatsapp", async (req, res) => {
  console.log("📩 Mensaje recibido:", req.body);

  const { phone, message, type, mediaUrl } = req.body;

  // WhatsAuto debe enviar el número SIEMPRE
  if (!phone) {
    return res.json({
      reply:
        "No pude leer tu número 💛.\nRevisa que WhatsAuto tenga activada la opción *Enviar número del remitente*."
    });
  }

  let texto = (message || "").toLowerCase().trim();
  const whatsapp = phone.trim();

  // TRANSCRIPCIÓN DE AUDIO
  if (type === "voice" && mediaUrl) {
    texto = (await transcribirAudio(mediaUrl)).toLowerCase();
  }

  // ------------------------------------------------------
  // 1. BUSCAR O CREAR CLIENTE
  // ------------------------------------------------------
  let { data: cliente } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("whatsapp", whatsapp)
    .single();

  let nuevoCliente = false;

  if (!cliente) {
    const { data: creado } = await supabase
      .from("clientes_detallados")
      .insert({
        whatsapp,
        comuna: null,
        carrito: []
      })
      .select()
      .single();

    cliente = creado;
    nuevoCliente = true;
  }

  // ------------------------------------------------------
  // 2. CLIENTE NUEVO O SALUDO → MOSTRAR CATÁLOGO SIEMPRE
  // ------------------------------------------------------
  const saludo = ["hola", "buenas", "buenos días", "buenas tardes", "buenas noches"];
  if (
    nuevoCliente ||
    saludo.some((s) => texto.includes(s))
  ) {
    return res.json({
      reply:
        rules.catalogo_completo +
        "\n\n💛 ¿En qué comuna necesitas el despacho?"
    });
  }

  // ------------------------------------------------------
  // 3. DETECCIÓN DIRECTA DE “CATÁLOGO”
  // ------------------------------------------------------
  const palabrasCatalogo = ["catalogo", "catálogo", "ver menu", "menu", "ver catálogo"];
  if (palabrasCatalogo.some((p) => texto.includes
