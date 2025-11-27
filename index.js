import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import rules from "./rules.json" assert { type: "json" };
import { supabase } from "./supabase.js";
import { generarPrompt } from "./prompts.js";
import { transcribirAudio } from "./utils.js";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ====================================================
   RESPUESTA GPT (BREVE)
==================================================== */
async function responderGPT(texto, historial, cliente) {
  try {
    const prompt = generarPrompt(historial, texto, cliente);

    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: rules.intro },
        { role: "user", content: prompt }
      ]
    });

    return res.choices[0].message.content || "";
  } catch (e) {
    console.error("GPT error:", e);
    return "Tuvimos un problema 💛 intenta otra vez.";
  }
}

/* ====================================================
   VALIDADORES
==================================================== */
function validarComuna(texto) {
  const comunas = rules.comunas_con_reparto.map(c => c.toLowerCase());
  const msg = texto.toLowerCase();

  if (comunas.includes(msg)) return { reparto: true };
  return { reparto: false, domicilio: rules.retiro_domicilio };
}

function esNombre(t) {
  return t.split(" ").length >= 2 && t.length < 40;
}

function esDireccion(t) {
  return /\d/.test(t) && t.length > 5;
}

function esTelefono(t) {
  return /^[0-9+\s-]{7,15}$/.test(t);
}

/* ====================================================
   ENDPOINT PRINCIPAL
==================================================== */
app.post("/whatsapp", async (req, res) => {
  console.log("📩 Solicitud:", req.body);

  try {
    const { phone, message, type, mediaUrl } = req.body;
    const from = phone;
    let texto = message || "";

    if (type === "voice" && mediaUrl) {
      texto = await transcribirAudio(mediaUrl);
    }

    /* 1️⃣ Verificar cliente existente */
    let { data: cliente } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("whatsapp", from)
      .single();

    if (!cliente) {
      const { data: nuevoCliente } = await supabase
        .from("clientes_detallados")
        .insert({ whatsapp: from })
        .select()
        .single();

      cliente = nuevoCliente;

      return res.json({
        reply:
          `${rules.mensaje_catalogo}\n${JSON.stringify(rules.catalogo)}\n\n` +
          "¿Para qué comuna será el despacho?"
      });
    }

    /* 2️⃣ Validación comuna */
    if (!cliente.comuna) {
      const val = validarComuna(texto);

      if (val.reparto) {
        await supabase
          .from("clientes_detallados")
          .update({ comuna: texto })
          .eq("whatsapp", from);

        return res.json({ reply: "Perfecto 💛 ¿Qué deseas pedir?" });
      }

      return res.json({
        reply:
          `Lo siento 💛 no tenemos reparto a esa comuna.\n` +
          `Puedes retirar en: ${val.domicilio}\n\n¿Deseas continuar?`
      });
    }

    /* 3️⃣ Datos despacho */
    if (!cliente.nombre && esNombre(texto)) {
      await supabase
        .from("clientes_detallados")
        .update({ nombre: texto })
        .eq("whatsapp", from);

      return res.json({ reply: "Gracias 💛 ahora tu dirección completa." });
    }

    if (!cliente.direccion && esDireccion(texto)) {
      await supabase
        .from("clientes_detallados")
        .update({ direccion: texto })
        .eq("whatsapp", from);

      return res.json({
        reply: "Perfecto 💛 ¿Teléfono adicional o uso el mismo?"
      });
    }

    if (!cliente.telefono_adicional && esTelefono(texto)) {
      await supabase
        .from("clientes_detallados")
        .update({ telefono_adicional: texto })
        .eq("whatsapp", from);

      return res.json({
        reply: "Perfecto 💛 dime qué deseas pedir."
      });
    }

    /* 4️⃣ Historial */
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    /* 5️⃣ GPT */
    const respuesta = await responderGPT(texto, historial, cliente);

    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: texto,
      respuesta_luna: respuesta
    });

    /* 6️⃣ Confirmación */
    if (
      ["confirmo", "acepto", "sí confirmo", "confirmado"].some(v =>
        texto.toLowerCase().includes(v)
      )
    ) {
      await supabase.from("pedidos_completos").insert({
        whatsapp: from,
        nombre: cliente.nombre,
        comuna: cliente.comuna,
        direccion: cliente.direccion,
        telefono_adicional: cliente.telefono_adicional,
        pedido: cliente.pedido || "Sin detalle",
        confirmado: true
      });

      return res.json({
        reply: "¡Perfecto! Tu pedido quedó agendado 💛\n\n✔️"
      });
    }

    return res.json({ reply: respuesta });
  } catch (e) {
    console.error("Error:", e);
    return res.json({ reply: "Error inesperado 💛 intenta nuevamente." });
  }
});

/* SERVER */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Luna Bot listo en puerto", PORT));
