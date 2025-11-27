import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { cargarReglas } from "./rulesLoader.js";
import { generarPrompt } from "./prompts.js";
import { transcribirAudio } from "./utils.js";

import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* ============================================================
   GPT PRINCIPAL
============================================================ */
async function responderConGPT(texto, cliente, historial, reglas, memoria) {
  console.log("🤖 Enviando a GPT…");

  const prompt = generarPrompt(historial, texto, cliente, reglas, memoria);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: reglas },
      { role: "user", content: prompt }
    ],
    temperature: 0.7
  });

  return completion.choices[0].message.content;
}

/* ============================================================
   UTILIDAD: Validar comuna
============================================================ */
function comunaTieneCobertura(comuna, reglas) {
  const normalizada = comuna.toLowerCase().trim();
  return reglas.toLowerCase().includes(normalizada);
}

/* ============================================================
   ENDPOINT PRINCIPAL
============================================================ */
app.post("/whatsapp", async (req, res) => {
  console.log("📩 [WEBHOOK] Mensaje recibido:", req.body);

  try {
    const { phone, message, type, mediaUrl } = req.body;
    const from = phone;
    let texto = message || "";

    // Transcripción si es nota de voz
    if (type === "voice" && mediaUrl) {
      texto = await transcribirAudio(mediaUrl);
    }

    // Cargar reglas desde tabla luna_rules
    const reglas = await cargarReglas();

    // ------------------------------------------
    // 1. Buscar cliente
    // ------------------------------------------
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
      cliente = nuevo.data[0];
      console.log("🆕 Cliente nuevo creado:", from);
    }

    // ------------------------------------------
    // 2. Cargar historial
    // ------------------------------------------
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    // ------------------------------------------
    // 3. BIENVENIDA PARA CLIENTES NUEVOS
    // ------------------------------------------
    if (clienteNuevo) {
      console.log("🎉 Enviando catálogo inicial…");
      const bienvenida = `${reglas.split("Catálogo:")[0]}

¿Qué deseas pedir hoy? 💛`;

      await supabase.from("historial").insert({
        whatsapp: from,
        mensaje_cliente: texto,
        respuesta_luna: bienvenida
      });

      return res.json({ reply: bienvenida });
    }

    // ------------------------------------------
    // 4. Memoria temporal del pedido (Solo en RAM)
    // ------------------------------------------
    if (!global.memoriaPedidos) global.memoriaPedidos = {};
    if (!global.memoriaPedidos[from]) {
      global.memoriaPedidos[from] = {
        productos: [],
        total: 0,
        comuna: null,
        direccion: null,
        nombre: null,
        telefono_adicional: null,
        costo_envio: null,
        fecha_entrega: null,
        hora_estimada: null,
        confirmacionPendiente: false
      };
    }

    const memoria = global.memoriaPedidos[from];

    // ------------------------------------------
    // 5. CONFIRMACIÓN FINAL
    // GPT debe detectar cualquier frase afirmativa
    // ------------------------------------------
    if (memoria.confirmacionPendiente) {
      const lower = texto.toLowerCase();

      const afirmaciones = [
        "sí",
        "si",
        "confirmo",
        "está bien",
        "correcto",
        "todo ok",
        "dale",
        "ok",
        "listo",
        "perfecto"
      ];

      if (afirmaciones.some(a => lower.includes(a))) {
        console.log("🟢 Confirmación FINAL detectada");

        await supabase.from("pedidos_completos").insert({
          nombre: memoria.nombre,
          whatsapp: from,
          direccion: memoria.direccion,
          comuna: memoria.comuna,
          pedido: JSON.stringify(memoria.productos),
          valor_total: memoria.total,
          costo_envio: memoria.costo_envio,
          fecha_entrega: memoria.fecha_entrega,
          hora_estimada: memoria.hora_estimada,
          confirmado: true
        });

        delete global.memoriaPedidos[from];

        return res.json({
          reply: "¡Perfecto! Tu pedido quedó registrado con éxito 💛✨\n\n✅"
        });
      }
    }

    // ------------------------------------------
    // 6. GPT responde y construye el pedido
    // ------------------------------------------
    const respuesta = await responderConGPT(
      texto,
      cliente,
      historial,
      reglas,
      memoria
    );

    // Guardar historial
    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: texto,
      respuesta_luna: respuesta
    });

    return res.json({ reply: respuesta });
  } catch (e) {
    console.error("❌ Error general:", e);
    return res.json({ reply: "Lo siento 💛 ocurrió un error, intenta nuevamente." });
  }
});

/* ============================================================
   SERVIDOR
============================================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Luna lista en puerto ${PORT}`));
