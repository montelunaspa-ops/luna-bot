import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { generarPrompt } from "./prompts.js";
import { transcribirAudio } from "./utils.js";
import { obtenerReglasDesdeDB } from "./lunaRules.js";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -----------------------------------------------------
   🧠 FUNCIÓN: GPT con reglas externas
----------------------------------------------------- */
async function responderConGPT(texto, cliente, historial = []) {
  console.log("🔎 Enviando mensaje a GPT…");

  const reglas = await obtenerReglasDesdeDB();
  const prompt = generarPrompt(historial, texto, cliente, reglas);

  try {
    const gptResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: reglas },
        { role: "user", content: prompt }
      ],
      temperature: 0.75
    });

    return gptResponse.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error("❌ Error en GPT:", e);
    return "Hubo un problema al generar tu respuesta 💛 Intenta nuevamente.";
  }
}

/* -----------------------------------------------------
  📌 DETECTAR CONFIRMACIÓN
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
    texto.includes("realizar pedido")
  );
}

/* -----------------------------------------------------
  📌 CAMPOS REQUERIDOS PARA DESPACHO
----------------------------------------------------- */
const camposCliente = ["nombre", "direccion", "comuna", "telefono_adicional"];

async function gestionarDatosCliente(cliente, from, mensaje) {
  for (let campo of camposCliente) {
    if (!cliente[campo]) {
      console.log(`🟡 Cliente debe entregar: ${campo}`);

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

/* -----------------------------------------------------
   📌 ENDPOINT ROOT
----------------------------------------------------- */
app.get("/", (req, res) => {
  res.send("Luna bot funcionando correctamente ✨");
});

/* -----------------------------------------------------
   📌 ENDPOINT PRINCIPAL WHATSAPP
----------------------------------------------------- */
app.post("/whatsapp", async (req, res) => {
  console.log("📩 Request recibido:", req.body);

  try {
    const { phone, message, type, mediaUrl } = req.body;
    const from = phone;

    let textoMensaje = message || "";

    if (type === "voice" && mediaUrl) {
      console.log("🎙 Recibida nota de voz. Transcribiendo…");
      try {
        textoMensaje = await transcribirAudio(mediaUrl);
        console.log("📝 Texto transcrito:", textoMensaje);
      } catch (e) {
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
      console.log("🆕 Cliente nuevo detectado. Creando…");

      const { data: nuevoCliente, error: insertError } = await supabase
        .from("clientes_detallados")
        .insert({ whatsapp: from })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error insertando cliente:", insertError);
        return res.json({
          reply: "Lo siento 💛 ocurrió un error al registrarte. Intenta nuevamente."
        });
      }

      cliente = nuevoCliente;
      clienteNuevo = true;

      console.log("🆕 Cliente creado correctamente:", cliente);
    }

    /* 2️⃣ CONFIRMACIÓN DE PEDIDO */
    if (clienteConfirmoPedido(textoMensaje)) {
      console.log("🟢 Cliente confirmó el pedido. Guardando…");

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
          "¡Pedido confirmado con éxito! Gracias por preferir Delicias Monte Luna ❤️✨\n\n**✅ Tu pedido será entregado mañana (excepto domingos).**"
      });
    }

    /* 3️⃣ HISTORIAL */
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    /* 4️⃣ BIENVENIDA INICIAL */
    if (clienteNuevo) {
      const reglas = await obtenerReglasDesdeDB();
      return res.json({
        reply: reglas.split("Catálogo:")[0] + "\n\n¿Qué deseas pedir hoy? 💛"
      });
    }

    /* 5️⃣ FALTAN DATOS */
    const campoPendiente = await gestionarDatosCliente(cliente, from, textoMensaje);

    if (campoPendiente) {
      return res.json({
        reply: `Perfecto 💛 Ahora indícame tu **${campoPendiente}** para continuar.`
      });
    }

    /* 6️⃣ RESPUESTA GENERAL GPT */
    const respuesta = await responderConGPT(textoMensaje, cliente, historial);

    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuesta
    });

    return res.json({ reply: respuesta });
  } catch (e) {
    console.error("❌ Error general:", e);
    return res.json({
      reply: "Ocurrió un error inesperado 💛 Por favor intenta nuevamente."
    });
  }
});

/* SERVIDOR */
const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => console.log(`🚀 Luna bot listo en puerto ${PORT}`));
