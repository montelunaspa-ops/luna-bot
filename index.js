// =========================
//        LUNA BOT
//       index.js
// =========================

import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { generarPrompt } from "./prompts.js";
import { cargarReglas } from "./rulesLoader.js";
import { transcribirAudio } from "./utils.js";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Estados temporales EN MEMORIA
let estadosUsuarios = {}; // { whatsapp: { resumen, pedidoListo, datosPendientes } }

// ======================================================
// 🤖 GPT con reglas externas
// ======================================================
async function responderConGPT(texto, cliente, historial = []) {
  console.log("🔎 Enviando mensaje a GPT…");

  const reglas = await cargarReglas();
  const prompt = generarPrompt(historial, texto, cliente, reglas);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: reglas },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    return completion.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error("❌ Error en GPT:", e);
    return "Hubo un problema al generar tu respuesta 💛 Intenta nuevamente.";
  }
}

// ======================================================
// ✔ DETECTAR si cliente confirmó pedido
// ======================================================
function confirmacionPedido(texto) {
  if (!texto) return false;
  texto = texto.toLowerCase();
  return (
    texto.includes("confirmo") ||
    texto.includes("si confirmo") ||
    texto.includes("sí confirmo") ||
    texto.includes("acepto") ||
    texto.includes("está bien") ||
    texto.includes("correcto") ||
    texto.includes("ok") ||
    texto.includes("vale")
  );
}

// ======================================================
// ✔ DETECTAR si comuna tiene despacho
// ======================================================
const comunasConCobertura = [
  "cerro navia","cerrillos","conchali","conchalí","estacion central","estación central",
  "independencia","lo prado","lo espejo","maipu","maipú","pedro aguirre cerda",
  "pudahuel","quinta normal","recoleta","renca","santiago","santiago centro",
  "san miguel","san joaquin","san joaquín"
];

function comunaValida(c) {
  if (!c) return false;
  return comunasConCobertura.includes(c.toLowerCase());
}

// ======================================================
// ✔ ENDPOINT ROOT
// ======================================================
app.get("/", (_, res) => res.send("Luna bot funcionando correctamente ✨"));

// ======================================================
// 📩 ENDPOINT PRINCIPAL: WHATSAPP
// ======================================================
app.post("/whatsapp", async (req, res) => {
  console.log("📩 [WEBHOOK] Mensaje recibido:", req.body);

  try {
    const { phone, message, type, mediaUrl } = req.body;
    const from = phone;
    let textoMensaje = message || "";

    // Si es nota de voz
    if (type === "voice" && mediaUrl) {
      try {
        console.log("🎙 Transcribiendo nota de voz…");
        textoMensaje = await transcribirAudio(mediaUrl);
      } catch {
        textoMensaje = "[nota de voz no entendida]";
      }
    }

    // ======================================================
    // 1️⃣ Buscar o crear cliente
    // ======================================================
    let { data: cliente } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("whatsapp", from)
      .single();

    let clienteNuevo = false;

    if (!cliente) {
      await supabase
        .from("clientes_detallados")
        .insert({ whatsapp: from });

      clienteNuevo = true;
      cliente = { whatsapp: from };
      console.log("🆕 Cliente nuevo detectado:", from);
    }

    // Crear estado temporal si no existe
    if (!estadosUsuarios[from]) {
      estadosUsuarios[from] = {
        paso: "inicio",
        resumen: null,
        pedidoListo: false,
        datosPendientes: null
      };
    }

    const estado = estadosUsuarios[from];

    // ======================================================
    // 2️⃣ Mensaje de bienvenida SOLO cliente nuevo
    // ======================================================
    if (clienteNuevo) {
      const reglas = await cargarReglas();
      const bienvenida =
        reglas.split("Catálogo:")[0] +
        "\n\nAquí tienes nuestro catálogo 👇\n\n" +
        reglas.split("Catálogo:")[1].split("Reglas de despacho")[0] +
        "\n\n💛 ¿Para qué comuna sería el despacho?";

      return res.json({ reply: bienvenida });
    }

    // ======================================================
    // 3️⃣ Validar comuna (primer paso obligatorio)
    // ======================================================
    if (estado.paso === "inicio") {
      if (!comunaValida(textoMensaje)) {
        return res.json({
          reply:
            "Necesito saber la **comuna de despacho** para continuar 💛\n\n" +
            "Estas son las comunas con cobertura:\n" +
            comunasConCobertura.map(c => `• ${c}`).join("\n")
        });
      }

      estado.comuna = textoMensaje;
      estado.paso = "tomando_pedido";

      return res.json({
        reply: "Perfecto 💛 ¡Sí tenemos cobertura en tu comuna!\n\n¿Qué deseas pedir hoy?"
      });
    }

    // ======================================================
    // 4️⃣ Si ya se tomó el pedido y GPT armó un RESUMEN
    // ======================================================
    if (estado.pedidoListo && estado.resumen) {
      if (!confirmacionPedido(textoMensaje)) {
        return res.json({
          reply:
            "Si deseas que procesemos tu pedido, por favor confirma 💛\n\n" +
            "Solo responde: **confirmo**"
        });
      }

      // Confirmación → solicitar datos cliente
      estado.paso = "datos_cliente";

      return res.json({
        reply:
          "¡Perfecto! 💛 Ahora necesito los datos para el despacho:\n\n" +
          "1️⃣ Nombre y apellido\n" +
          "2️⃣ Dirección exacta\n" +
          "3️⃣ Teléfono adicional"
      });
    }

    // ======================================================
    // 5️⃣ Captura de datos del cliente después de confirmar resumen
    // ======================================================
    if (estado.paso === "datos_cliente") {
      if (!cliente.nombre) {
        await supabase
          .from("clientes_detallados")
          .update({ nombre: textoMensaje })
          .eq("whatsapp", from);
        cliente.nombre = textoMensaje;

        return res.json({ reply: "Gracias 💛 Ahora indícame tu **dirección exacta** 📍" });
      }

      if (!cliente.direccion) {
        await supabase
          .from("clientes_detallados")
          .update({ direccion: textoMensaje })
          .eq("whatsapp", from);
        cliente.direccion = textoMensaje;

        return res.json({ reply: "Perfecto 💛 ¿Algún teléfono adicional o contacto?" });
      }

      if (!cliente.telefono_adicional) {
        await supabase
          .from("clientes_detallados")
          .update({ telefono_adicional: textoMensaje })
          .eq("whatsapp", from);
        cliente.telefono_adicional = textoMensaje;

        estado.paso = "confirmando_datos";

        return res.json({
          reply:
            "Gracias 💛 Aquí tienes el resumen final para confirmar:\n\n" +
            estado.resumen +
            "\n\n¿Confirmas que toda la información está correcta?"
        });
      }
    }

    // ======================================================
    // 6️⃣ Confirmación final → Guardado en Supabase
    // ======================================================
    if (estado.paso === "confirmando_datos") {
      if (!confirmacionPedido(textoMensaje)) {
        return res.json({
          reply: "Si todo está correcto, responde **confirmo** 💛"
        });
      }

      console.log("💾 Guardando pedido completo…");

      await supabase.from("pedidos_completos").insert({
        nombre: cliente.nombre,
        whatsapp: from,
        direccion: cliente.direccion,
        comuna: estado.comuna,
        pedido: estado.resumen,
        valor_total: 0, // GPT no maneja dinero
        costo_envio: 2400,
        confirmado: true
      });

      delete estadosUsuarios[from];

      return res.json({
        reply:
          "¡Pedido confirmado con éxito! 💛\nMañana realizaremos la entrega (excepto domingos).\n\n✔️"
      });
    }

    // ======================================================
    // 7️⃣ GPT Maneja conversación normal y genera resumen
    // ======================================================
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    const respuesta = await responderConGPT(textoMensaje, cliente, historial);

    // Detectar si GPT generó resumen
    if (respuesta.includes("RESUMEN DEL PEDIDO")) {
      estado.resumen = respuesta;
      estado.pedidoListo = true;
    }

    // Guardar historial
    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: textoMensaje,
      respuesta_luna: respuesta
    });

    return res.json({ reply: respuesta });
  } catch (e) {
    console.error("❌ Error general:", e);
    return res.json({
      reply:
        "Ocurrió un error inesperado 💛 Por favor intenta nuevamente."
    });
  }
});

// ======================================================
// SERVIDOR
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Luna lista en puerto ${PORT}`));
