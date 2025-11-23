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

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ================================
// 🔹 FUNCION: RESPUESTA LIBRE INTELIGENTE
// ================================
async function responderPreguntaLibre(texto, responder) {
  const triggers = [
    "precio", "cuánto", "cuanto", "vale", "tienes", "hay",
    "sabores", "sabor", "envío", "envios", "despacho", "delivery",
    "horario", "pago", "metodo", "tamaño", "medida", "cuales", "como es"
  ];

  const lower = texto.toLowerCase();
  const esPregunta = triggers.some(t => lower.includes(t));

  if (!esPregunta) return false;

  const respuesta = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
Eres Luna, asistente de Delicias Monte Luna.
Responde de forma amable y clara usando SOLO la información oficial:

CATÁLOGO:
- Queques artesanales 14 y 20 cm (arándanos, frambuesa, nuez)
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
- Queque con Manjar (sabores: piña, vainilla, chocolate, marmoleado, naranja y maracuyá)
- Queque Premium de Vainilla
- Donuts de Chocolate

NO inventes precios si no están: responde diciendo que se cotizan al confirmar el pedido.
NO rompas el flujo, solo complementa dudas.
        `
      },
      { role: "user", content: texto }
    ],
    temperature: 0.6
  });

  await responder(respuesta.choices[0].message.content);
  return true;
}

// ================================
// 🔹 FUNCION: DETECTAR CONFIRMACIÓN DE PEDIDO
// ================================
function clienteConfirmoPedido(texto) {
  texto = texto.toLowerCase();
  return (
    texto.includes("confirmo") ||
    texto.includes("si confirmo") ||
    texto.includes("sí confirmo") ||
    texto.includes("acepto") ||
    texto.includes("confirmado") ||
    texto.includes("hagan el pedido") ||
    texto.includes("realizar pedido") ||
    texto.includes("quiero mi pedido") ||
    texto.includes("quiero el pedido")
  );
}

// ================================
// 🔹 ENDPOINT DE PRUEBA
// ================================
app.get("/", (req, res) => {
  res.send("Servidor Luna funcionando ✅");
});

// ================================
// 🔹 ENDPOINT PRINCIPAL WHATAUTO
// ================================
app.post("/whatsapp", async (req, res) => {
  try {
    const { from, message, type, mediaUrl } = req.body;

    // 1️⃣ Buscar o crear cliente
    let { data: cliente } = await supabase
      .from("clientes")
      .select("*")
      .eq("whatsapp", from)
      .single();

    if (!cliente) {
      const insert = await supabase
        .from("clientes")
        .insert({ whatsapp: from })
        .select();
      cliente = insert.data?.[0] || { whatsapp: from };
    }

    // 2️⃣ Convertir voz → texto
    let textoMensaje = message;
    if (type === "voice" && mediaUrl) {
      try {
        textoMensaje = await transcribirAudio(mediaUrl);
      } catch {
        textoMensaje = "[Nota de voz no entendida]";
      }
    }

    // 3️⃣ Manejar confirmación de pedido
    if (clienteConfirmoPedido(textoMensaje)) {
      return res.json({
        reply: "¡Perfecto! Tu pedido ha sido confirmado. Gracias por comprar en Delicias Monte Luna ❤️🥰\n\n**✅**"
      });
    }

    // 4️⃣ Respuesta libre inteligente
    const respondida = await responderPreguntaLibre(textoMensaje, async (msg) => {
      return res.json({ reply: msg });
    });
    if (respondida) return;

    // 5️⃣ Obtener historial
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    // 6️⃣ Generar prompt del flujo principal
    const prompt = generarPrompt(historial || [], textoMensaje, cliente);

    // 7️⃣ GPT Respuesta principal
    let respuestaLuna = "";
    try {
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres Luna, asistente virtual de Delicias Monte Luna. Mantén un flujo comercial claro, humano y natural. No repitas mensajes de bienvenida. Responde según el contexto del historial."
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7
      });

      respuestaLuna = gptResponse.choices?.[0]?.message?.content;
    } catch (e) {
      respuestaLuna = "Hubo un error generando tu respuesta. Intenta nuevamente 💛";
    }

    // 8️⃣ Guardar historial
    try {
      await supabase.from("historial").insert({
        whatsapp: from,
        mensaje_cliente: textoMensaje,
        respuesta_luna: respuestaLuna
      });
    } catch {}

    // 9️⃣ Enviar respuesta
    if (!respuestaLuna) respuestaLuna = "No pude procesar tu mensaje, intenta nuevamente 💛";

    res.json({ reply: respuestaLuna });
  } catch (error) {
    console.error("Error en /whatsapp:", error);
    res.json({
      reply: "Ocurrió un error, intenta nuevamente más tarde 💛"
    });
  }
});

// ================================
// 🔹 PUERTO RENDER
// ================================
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
