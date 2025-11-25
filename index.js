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

/* -----------------------------------------------------
   🧠 FUNCIÓN: GPT
----------------------------------------------------- */
async function responderConGPT(texto, cliente, historial = []) {
  console.log("🧠 Enviando solicitud a GPT...");

  const reglas = await cargarReglas(); // ← Carga desde tabla luna_rules
  const prompt = generarPrompt(historial, texto, cliente, reglas);

  try {
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: reglas },
        { role: "user", content: prompt }
      ],
      temperature: 0.8
    });

    return gptResponse.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error("❌ Error en GPT:", e);
    return "Hubo un problema al generar tu respuesta 💛 Intenta nuevamente.";
  }
}

/* -----------------------------------------------------
  🟢 DETECTAR CONFIRMACIÓN
----------------------------------------------------- */
function clienteConfirmoPedido(texto) {
  if (!texto || typeof texto !== "string") return false;

  texto = texto.toLowerCase();

  return (
    texto.includes("confirmo") ||
    texto.includes("sí confirmo") ||
    texto.includes("si confirmo") ||
    texto.includes("acepto") ||
    texto.includes("confirmado") ||
    texto.includes("todo correcto") ||
    texto.includes("está bien") 
  );
}

/* -----------------------------------------------------
   🔎 CAMPOS QUE SE PIDEN AL FINAL
----------------------------------------------------- */
const camposFinales = ["nombre", "direccion", "comuna", "telefono_adicional"];

/* -----------------------------------------------------
   ROOT
----------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("Luna bot funcionando correctamente ✨");
});

/* -----------------------------------------------------
   ENDPOINT PRINCIPAL /whatsapp
----------------------------------------------------- */
app.post("/whatsapp", async (req, res) => {
  console.log("📥 [WEBHOOK] Mensaje recibido:", req.body);

  try {
    const { phone, message, type, mediaUrl } = req.body;
    const from = phone;
    let textoMensaje = message || "";

    /* 🎙 NOTA DE VOZ */
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

    let nuevoCliente = false;

    if (!cliente) {
      const nuevo = await supabase
        .from("clientes_detallados")
        .insert({ whatsapp: from })
        .select();

      cliente = nuevo.data?.[0];
      nuevoCliente = true;
      console.log("🆕 Cliente nuevo:", from);
    }

    /* 2️⃣ OBTENER HISTORIAL */
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    /* 3️⃣ SI ES NUEVO → BIENVENIDA */
    if (nuevoCliente) {
      const reglas = await cargarReglas();
      const bienvenida = reglas.split("Catálogo:")[0] + "\n\n¿Qué deseas pedir hoy? 💛";

      await supabase.from("historial").insert({
        whatsapp: from,
        mensaje_cliente: textoMensaje,
        respuesta_luna: bienvenida
      });

      return res.json({ reply: bienvenida });
    }

    /* 4️⃣ SI AÚN NO CONFIRMA EL PEDIDO → LA IA SIGUE GESTIONANDO */
    if (!clienteConfirmoPedido(textoMensaje)) {
      const respuesta = await responderConGPT(textoMensaje, cliente, historial);

      await supabase.from("historial").insert({
        whatsapp: from,
        mensaje_cliente: textoMensaje,
        respuesta_luna: respuesta
      });

      return res.json({ reply: respuesta });
    }

    /* 5️⃣ CONFIRMÓ → GUARDAR PEDIDO */
    console.log("🟢 Cliente confirmó. Guardando pedido completo…");

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
      reply: "¡Pedido confirmado con éxito! ❤️✨\n\n**✅ Será entregado mañana (excepto domingos).**"
    });

  } catch (e) {
    console.error("❌ Error general:", e);
    return res.json({
      reply: "Ocurrió un error inesperado 💛 Intenta nuevamente."
    });
  }
});

/* SERVIDOR */
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`🚀 Luna bot LISTO en puerto ${PORT}`));
