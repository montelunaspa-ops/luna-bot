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
    🔹 FUNCION: RESPUESTA INTELIGENTE GENERAL
============================================================ */
async function responderConGPT(texto, cliente, historial = []) {
  const prompt = generarPrompt(historial, texto, cliente);

  try {
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: `
Eres Luna, asistente de Delicias Monte Luna.
Habla de manera natural, amable y enfocada en ventas.
Usa el historial del cliente.
Responde preguntas de productos y sabores en cualquier momento.
Ofrece opciones claras y guía el pedido.
        `},
        { role: "user", content: prompt }
      ],
      temperature: 0.75
    });
    return gptResponse.choices?.[0]?.message?.content || "";
  } catch {
    return "Hubo un problema al generar tu respuesta 💛 Intenta nuevamente.";
  }
}

/* ============================================================
    🔹 DETECTAR DATOS FALTANTES
============================================================ */
const camposCliente = ["nombre", "direccion", "telefono_adicional"];
async function gestionarDatosFaltantes(cliente, from, textoMensaje) {
  // Inicializar campos vacíos
  camposCliente.forEach(c => {
    cliente[c] = cliente[c] || "";
  });

  for (let campo of camposCliente) {
    if (!cliente[campo] && textoMensaje) {
      // Guardar dato en la base de datos
      const updateObj = {};
      updateObj[campo] = textoMensaje;
      await supabase.from("clientes_detallados").update(updateObj).eq("whatsapp", from);
      cliente[campo] = textoMensaje;
      return campo; // Retornar el campo que se acaba de completar
    }
  }

  // Retornar null si no falta ningún dato
  return null;
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
    texto.includes("confirmado")
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

    let textoMensaje = message || "";

    if (type === "voice" && mediaUrl) {
      try { textoMensaje = await transcribirAudio(mediaUrl); }
      catch { textoMensaje = "[Nota de voz no entendida]"; }
    }

    // 1️⃣ Buscar o crear cliente
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

    // 2️⃣ Confirmación de pedido
    if (clienteConfirmoPedido(textoMensaje)) {
      // Guardar pedido
      await supabase.from("pedidos").insert({
        whatsapp: from,
        confirmado: true
      });

      return res.json({
        reply: "¡Pedido confirmado con éxito! Gracias por preferir Delicias Monte Luna ❤️✨\n✅ Tu pedido será entregado al día siguiente (excepto domingos)."
      });
    }

    // 3️⃣ Historial del cliente
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    // 4️⃣ Mensaje de bienvenida si es cliente nuevo
    if (clienteNuevo) {
      const bienvenida = `
¡Hola! Soy Luna, tu asistente de Delicias Monte Luna ✨
Nuestro catálogo incluye:
- Queques 14 y 20 cm (arándanos, frambuesa, nuez)
- Pan de Guayaba 40 cm
- Alfajores (Maicena y Sabores)
- Muffins: chocolate, red velvet, chips chocolate, coco, manzana
- Queques con manjar o premium
- Donuts de chocolate

¿Qué deseas pedir hoy? 💛
      `;
      // Guardar el mensaje en historial
      await supabase.from("historial").insert({
        whatsapp: from,
        mensaje_cliente: textoMensaje,
        respuesta_luna: bienvenida
      });
      return res.json({ reply: bienvenida });
    }

    // 5️⃣ Gestionar datos faltantes
    const campoFaltante = await gestionarDatosFaltantes(cliente, from, textoMensaje);
    if (campoFaltante) {
      return res.json({ reply: `Antes de continuar, necesito tu **${campoFaltante}**. 💛` });
    }

    // 6️⃣ Respuesta GPT general
    const respuestaGPT = await responderConGPT(textoMensaje, cliente, historial || []);

    // Guardar historial
    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuestaGPT
    });

    return res.json({ reply: respuestaGPT });

  } catch (e) {
    console.error("Error en /whatsapp:", e);
    return res.json({ reply: "Ocurrió un error interno. Intenta nuevamente 💛" });
  }
});

/* ============================================================
    🔹 PUERTO
============================================================ */
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor Luna arriba en puerto ${PORT}`));
