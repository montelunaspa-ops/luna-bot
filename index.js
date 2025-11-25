import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { generarPrompt } from "./prompts.js";
import { transcribirAudio } from "./utils.js";
import { cargarReglas } from "./rulesLoader.js";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ============================================================
   🧠 GPT CON REGLAS EXTERNAS
============================================================ */
async function responderConGPT(texto, cliente, historial = []) {
  console.log("🔎 [GPT] Preparando prompt…");

  const reglas = await cargarReglas();
  const prompt = generarPrompt(historial, texto, cliente, reglas);

  try {
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: reglas },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    return gptResponse.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error("❌ [GPT] Error:", e);
    return "Ocurrió un problema al generar tu respuesta 💛";
  }
}

/* ============================================================
   ✔ DETECTAR CONFIRMACIÓN DE PEDIDO
============================================================ */
function clienteConfirmoPedido(texto) {
  if (!texto) return false;
  texto = texto.toLowerCase();

  return (
    texto.includes("confirmo") ||
    texto.includes("si confirmo") ||
    texto.includes("sí confirmo") ||
    texto.includes("acepto") ||
    texto.includes("está bien") ||
    texto.includes("confirmado") ||
    texto.includes("realizar pedido")
  );
}

/* ============================================================
   ✔ CAMPOS REQUERIDOS PARA DESPACHO
============================================================ */
const camposCliente = ["nombre", "direccion", "comuna", "telefono_adicional"];

async function gestionarDatosCliente(cliente, from, mensaje) {
  for (let campo of camposCliente) {
    if (!cliente[campo]) {
      console.log(`🟡 [CLIENTE] Falta el campo: ${campo}`);

      const updateObj = {};
      updateObj[campo] = mensaje;

      await supabase
        .from("clientes_detallados")
        .update(updateObj)
        .eq("whatsapp", from);

      return campo;
    }
  }
  return null;
}

/* ============================================================
  🟦 ENDPOINT ROOT
============================================================ */
app.get("/", (req, res) => {
  res.send("🌙 Luna Bot funcionando correctamente.");
});

/* ============================================================
  🟨 ENDPOINT PRINCIPAL WHATSAPP
============================================================ */
app.post("/whatsapp", async (req, res) => {
  console.log("📥 [WEBHOOK] Mensaje recibido:", req.body);

  try {
    const { phone, message, type, mediaUrl } = req.body;
    const from = phone;
    let textoMensaje = message || "";

    /* 🎤 VOZ → TEXTO */
    if (type === "voice" && mediaUrl) {
      try {
        textoMensaje = await transcribirAudio(mediaUrl);
      } catch {
        textoMensaje = "[Nota de voz no entendida]";
      }
    }

    /* 1️⃣ BUSCAR O CREAR CLIENTE */
    let { data: cliente } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("whatsapp", from)
      .single();

    let clienteNuevo = false;

    if (!cliente) {
      clienteNuevo = true;
      const nuevo = await supabase
        .from("clientes_detallados")
        .insert({ whatsapp: from })
        .select();

      cliente = nuevo.data?.[0];
      console.log("🆕 [CLIENTE] Cliente nuevo:", from);
    }

    /* 2️⃣ CONFIRMAR PEDIDO */
    if (clienteConfirmoPedido(textoMensaje)) {
      console.log("🟢 [PEDIDO] Confirmado por el cliente.");

      await supabase.from("pedidos_completos").insert({
        nombre: cliente.nombre,
        whatsapp: from,
        direccion: cliente.direccion,
        comuna: cliente.comuna,
        pedido: cliente.pedido || "Pedido no detallado",
        valor_total: cliente.valor_total || 0,
        costo_envio: cliente.costo_envio || 0,
        fecha_entrega: cliente.fecha_entrega || null,
        hora_estimada: cliente.hora_estimada || null,
        confirmado: true
      });

      return res.json({
        reply:
          "¡Pedido confirmado con éxito! 🎉💛\n\nSerá entregado mañana (excepto domingos)."
      });
    }

    /* 3️⃣ HISTORIAL */
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    /* 4️⃣ BIENVENIDA */
    if (clienteNuevo) {
      const reglas = await cargarReglas();
      const bienvenida = reglas.split("Catálogo:")[0];

      return res.json({
        reply: bienvenida + "\n\n¿Qué deseas pedir hoy? 💛"
      });
    }

    /* 5️⃣ DATOS FALTANTES */
    const campoPend = await gestionarDatosCliente(cliente, from, textoMensaje);

    if (campoPend) {
      return res.json({
        reply: `Perfecto 💛 Ahora necesito tu **${campoPend}** para continuar.`
      });
    }

    /* 6️⃣ GPT RESPUESTA GENERAL */
    const respuesta = await responderConGPT(textoMensaje, cliente, historial);

    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuesta
    });

    res.json({ reply: respuesta });
  } catch (e) {
    console.error("❌ [ERROR GENERAL]", e);
    res.json({
      reply: "Ocurrió un error inesperado 💛 Intenta nuevamente."
    });
  }
});

/* 🚀 SERVIDOR */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Luna Bot listo en puerto ${PORT}`));
