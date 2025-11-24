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

/* RESPUESTA LIBRE INTELIGENTE */
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

/* CONFIRMACIÓN DE PEDIDO */
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

/* ENDPOINT PRUEBA */
app.get("/", (req, res) => {
  res.send("Servidor Luna funcionando correctamente ✨");
});

/* ENDPOINT PRINCIPAL /whatsapp */
app.post("/whatsapp", async (req, res) => {
  try {
    const { phone, message, type, mediaUrl } = req.body;
    const from = phone;

    if (!message && !mediaUrl) {
      return res.json({ reply: "¡Gracias por tu mensaje! 😊 Por ahora solo puedo responder texto. ¿En qué puedo ayudarte?" });
    }

    let textoMensaje = message || "";

    if (type === "voice" && mediaUrl) {
      try { textoMensaje = await transcribirAudio(mediaUrl); }
      catch { textoMensaje = "[Nota de voz no entendida]"; }
    }

    /* Buscar o crear cliente */
    let { data: cliente } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("whatsapp", from)
      .single();

    let clienteNuevo = false;
    if (!cliente) {
      const nuevo = await supabase
        .from("clientes_detallados")
        .insert({ whatsapp: from })
        .select();
      cliente = nuevo.data?.[0];
      clienteNuevo = true;
    }

    /* Mensaje de bienvenida para cliente nuevo */
    if (clienteNuevo) {
      return res.json({
        reply: `¡Hola! 👋 Soy Luna, tu asistente de Delicias Monte Luna.\nEstoy aquí para ayudarte con tus pedidos de queques, muffins, alfajores y más. 💛`
      });
    }

    /* Confirmación de pedido */
    if (clienteConfirmoPedido(textoMensaje)) {
      await supabase.from("pedidos").insert({
        whatsapp: from,
        confirmado: true
      });
      return res.json({ reply: "¡Pedido confirmado con éxito! Gracias por preferir Delicias Monte Luna ❤️✨\n\n**✅**" });
    }

    /* Respuesta libre inteligente */
    const respondida = await responderPreguntaLibre(textoMensaje, async msg => {
      return res.json({ reply: msg });
    });
    if (respondida) return;

    /* Historial */
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    /* Datos faltantes */
    cliente = cliente || {};
    cliente.nombre = cliente.nombre || "";
    cliente.comuna = cliente.comuna || "";
    cliente.direccion = cliente.direccion || "";
    cliente.punto_referencia = cliente.punto_referencia || "";
    cliente.tipo_vivienda = cliente.tipo_vivienda || "";
    cliente.metodo_pago = cliente.metodo_pago || "";

    const datosFaltantes = [];
    if (!cliente.nombre) datosFaltantes.push("nombre");
    if (!cliente.comuna) datosFaltantes.push("comuna");
    if (!cliente.direccion) datosFaltantes.push("dirección");
    if (!cliente.punto_referencia) datosFaltantes.push("punto de referencia");
    if (!cliente.tipo_vivienda) datosFaltantes.push("tipo de vivienda");
    if (!cliente.metodo_pago) datosFaltantes.push("método de pago");

    if (datosFaltantes.length > 0) {
      const siguiente = datosFaltantes[0];
      return res.json({ reply: `Antes de avanzar, necesito tu **${siguiente}**.\n\n¿Podrías indicarme tu ${siguiente}? 💛` });
    }

    /* Generar prompt */
    const prompt = generarPrompt(historial || [], textoMensaje, cliente);

    /* Respuesta GPT */
    let respuestaLuna = "";
    try {
      const gptResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Eres Luna, asistente de Delicias Monte Luna. No repitas mensajes de bienvenida. Habla natural, amable y orientada a ventas. Usa el historial del cliente. Ofrece opciones claras y guía el pedido." },
          { role: "user", content: prompt }
        ],
        temperature: 0.75
      });
      respuestaLuna = gptResponse.choices?.[0]?.message?.content;
    } catch {
      respuestaLuna = "Hubo un problema al generar tu respuesta 💛 Intenta nuevamente.";
    }

    /* Guardar historial */
    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuestaLuna
    });

    /* Responder */
    return res.json({ reply: respuestaLuna || "No pude procesar tu mensaje, intenta nuevamente 💛" });

  } catch (e) {
    console.error("Error en /whatsapp:", e);
    return res.json({ reply: "Ocurrió un error interno. Intenta nuevamente 💛" });
  }
});

/* PUERTO */
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor Luna arriba en puerto ${PORT}`));
