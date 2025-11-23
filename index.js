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
app.use(bodyParser.urlencoded({ extended: true })); // <- importante para x-www-form-urlencoded

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ==============================
// LOG de todas las solicitudes
// ==============================
app.use((req, res, next) => {
  console.log("📩 Request recibido en", req.url);
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  next();
});

// ==============================
// FUNCIÓN: RESPUESTA LIBRE INTELIGENTE
// ==============================
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
      {
        role: "system",
        content: `
Eres Luna, asistente de Delicias Monte Luna.
Responde dudas solo usando información oficial.
Catálogo: Queques, Pan de Guayaba, Alfajores, Muffins, Donuts.
No inventes precios.
        `
      },
      { role: "user", content: texto }
    ],
    temperature: 0.6
  });

  await responder(respuesta.choices[0].message.content);
  return true;
}

// ==============================
// DETECTAR CONFIRMACIÓN DE PEDIDO
// ==============================
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

// ==============================
// ENDPOINT PRINCIPAL /whatsapp
// ==============================
app.post("/whatsapp", async (req, res) => {
  try {
    // ⚡ Adaptado a WhatsAuto
    const from = req.body.phone; // número de whatsapp
    let textoMensaje = req.body.message || "";
    const type = "text"; // WhatsAuto solo envía texto
    const mediaUrl = null;

    if (!from || !textoMensaje) {
      return res.json({ reply: "No se pudo procesar tu mensaje. Intenta nuevamente." });
    }

    // 1️⃣ Buscar o crear cliente
    let { data: cliente } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("whatsapp", from)
      .single();

    if (!cliente) {
      const nuevo = await supabase
        .from("clientes_detallados")
        .insert({ whatsapp: from, nombre: req.body.sender })
        .select();
      cliente = nuevo.data?.[0];
    }

    // 2️⃣ Confirmación de pedido
    if (clienteConfirmoPedido(textoMensaje)) {
      await supabase.from("pedidos").insert({ whatsapp: from, confirmado: true });
      return res.json({ reply: "¡Pedido confirmado con éxito! Gracias por preferir Delicias Monte Luna ❤️✨" });
    }

    // 3️⃣ Respuesta libre inteligente
    const respondida = await responderPreguntaLibre(textoMensaje, async msg => res.json({ reply: msg }));
    if (respondida) return;

    // 4️⃣ Cargar historial
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    // 5️⃣ Detectar datos faltantes del cliente
    const datosFaltantes = [];
    if (!cliente.nombre) datosFaltantes.push("nombre");
    if (!cliente.comuna) datosFaltantes.push("comuna");
    if (!cliente.direccion) datosFaltantes.push("dirección");
    if (!cliente.punto_referencia) datosFaltantes.push("punto de referencia");
    if (!cliente.tipo_vivienda) datosFaltantes.push("tipo de vivienda");
    if (!cliente.metodo_pago) datosFaltantes.push("método de pago");

    if (datosFaltantes.length > 0) {
      const siguiente = datosFaltantes[0];
      return res.json({ reply: `Antes de avanzar, necesito tu **${siguiente}**. ¿Podrías indicarme tu ${siguiente}? 💛` });
    }

    // 6️⃣ Generar prompt principal
    const prompt = generarPrompt(historial || [], textoMensaje, cliente);

    // 7️⃣ GPT respuesta principal
    let respuestaLuna = "";
    try {
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres Luna, asistente de Delicias Monte Luna. Responde amable y orientada a ventas." },
          { role: "user", content: prompt }
        ],
        temperature: 0.75
      });
      respuestaLuna = gptResponse.choices?.[0]?.message?.content;
    } catch (e) {
      respuestaLuna = "Hubo un problema al generar tu respuesta 💛 Intenta nuevamente.";
    }

    // 8️⃣ Guardar historial
    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuestaLuna
    });

    // 9️⃣ Enviar respuesta final
    return res.json({ reply: respuestaLuna || "No pude procesar tu mensaje, intenta nuevamente 💛" });

  } catch (e) {
    console.error("Error en /whatsapp:", e);
    return res.json({ reply: "Ocurrió un error interno. Intenta nuevamente 💛" });
  }
});

// ==============================
// ENDPOINT DE PRUEBA
// ==============================
app.get("/", (req, res) => res.send("Servidor Luna funcionando correctamente ✨"));

// ==============================
// PUERTO
// ==============================
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor Luna arriba en puerto ${PORT}`));
