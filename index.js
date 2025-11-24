import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { generarPrompt } from "./prompts.js";
import { transcribirAudio } from "./utils.js";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ============================================================
    🔹 RESPUESTA LIBRE INTELIGENTE
============================================================ */
async function responderPreguntaLibre(texto, responder) {
  if (!texto || typeof texto !== "string") return false;

  const triggers = [
    "precio","cuánto","cuanto","vale","tienes","hay",
    "sabores","sabor","envío","envios","despacho","delivery",
    "horario","pago","metodo","tamaño","medida","cuales","como es"
  ];

  const lower = texto.toLowerCase();
  const esPregunta = triggers.some(t => lower.includes(t));
  if (!esPregunta) return false;

  const respuesta = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: `
Eres Luna, asistente de Delicias Monte Luna.
Responde dudas sin romper el flujo.
Catálogo oficial:
- Queques 14 y 20 cm (arándanos, frambuesa, nuez)
- Pan de Guayaba 40 cm
- Alfajor de Maicena
- Alfajores de Sabores
- Muffins (chocolate, red velvet, chips chocolate, coco, manzana)
- Queque de Piña
- Queque de Vainilla
- Queque de Chocolate
- Queque Marmoleado
- Queque de Maracuyá
- Queque de Naranja
- Queque con Manjar (piña, vainilla, chocolate, marmoleado, naranja, maracuyá)
- Queque Premium de Vainilla
- Donuts de Chocolate
No inventes precios.
      ` },
      { role: "user", content: texto }
    ],
    temperature: 0.6
  });

  await responder(respuesta.choices[0].message.content);
  return true;
}

/* ============================================================
    🔹 CONFIRMACIÓN DE PEDIDO
============================================================ */
function clienteConfirmoPedido(texto) {
  if (!texto || typeof texto !== "string") return false;
  texto = texto.toLowerCase();
  return (
    texto.includes("confirmo") ||
    texto.includes("sí confirmo") ||
    texto.includes("si confirmo") ||
    texto.includes("acepto") ||
    texto.includes("confirmado") ||
    texto.includes("realizar pedido") ||
    texto.includes("quiero mi pedido") ||
    texto.includes("hagan el pedido")
  );
}

/* ============================================================
    🔹 ENDPOINT DE PRUEBA
============================================================ */
app.get("/", (req, res) => {
  res.send("Servidor Luna funcionando correctamente ✨");
});

/* ============================================================
    🔹 ENDPOINT PRINCIPAL /whatsapp
============================================================ */
app.post("/whatsapp", async (req, res) => {
  try {
    const { phone, message, type, mediaUrl } = req.body;
    const from = phone;

    if (!message && !mediaUrl) {
      return res.json({ reply: "¡Gracias por tu mensaje! 😊 Por ahora solo puedo responder texto. ¿En qué puedo ayudarte?" });
    }

    let textoMensaje = message || "";

    if (type === "voice" && mediaUrl) {
      try {
