// index.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { transcribirAudio } from "./audio.js";
import { responderGPT } from "./gpt.js";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const rules = require("./rules.json");
const catalogo = require("./catalogo.json");

import {
  esNombre,
  esDireccion,
  esTelefono,
  validarComuna,
  detectarProducto,
  calcularResumen
} from "./helpers.js";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 🟢 CHECK SERVER
app.get("/", (req, res) => {
  res.send("🚀 Luna Bot funcionando correctamente.");
});

// 🟡 WHATSAPP ENDPOINT
app.post("/whatsapp", async (req, res) => {
  console.log("📩 [WEBHOOK] Mensaje recibido:", req.body);

  const { phone, message, type, mediaUrl } = req.body;

  // 🔥 Si WhatsAuto NO envía número → no podemos seguir
  if (!phone || phone.trim() === "") {
    return res.json({
      reply:
        "No pude leer tu número 💛. Revisa la configuración de WhatsAuto (debe enviar {sender} como phone)."
    });
  }

  const from = phone.trim();
  let textoMensaje = message || "";

  // 🎙 Notas de voz
  if (type === "voice" && mediaUrl) {
    textoMensaje = await transcribirAudio(mediaUrl);
    console.log("🎧 Transcripción:", textoMensaje);
  }

  // 1️⃣ Buscar o crear cliente
  let { data: cliente } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("whatsapp", from)
    .single();

  let nuevoCliente = false;

  if (!cliente) {
    const { data: cli, error } = await supabase
      .from("clientes_detallados")
      .insert({
        whatsapp: from,
        comuna: null,
        nombre: null,
        direccion: null,
        telefono_adicional: null,
        carrito: []
      })
      .select()
      .single();

    if (error) {
      return res.json({
        reply: "Hubo un error registrándote 💛. Intenta nuevamente."
      });
    }

    cliente = cli;
    nuevoCliente = true;
  }

  // 2️⃣ Cliente nuevo → enviar catálogo
  if (nuevoCliente) {
    return res.json({
      reply:
        rules.mensaje_bienvenida + "\n\n¿En qué comuna necesitas el despacho? 🚚"
    });
  }

  // 3️⃣ Validar comuna
  if (!cliente.comuna) {
    const comunaDet = validarComuna(textoMensaje);

    if (comunaDet.reparto) {
      await supabase
        .from("clientes_detallados")
        .update({ comuna: textoMensaje.toLowerCase() })
        .eq("whatsapp", from);

      return res.json({
        reply:
          `Perfecto 💛 hacemos reparto en *${textoMensaje}*.\n` +
          `Horario estimado: ${comunaDet.horario}.\n\n` +
          "¿Qué te gustaría pedir?"
      });
    }

    return res.json({
      reply:
        `Por ahora no llegamos a *${textoMensaje}* 😢\n` +
        `Pero puedes retirar en nuestro domicilio:\n📍 ${rules.retiro_domicilio}\n\n¿Deseas retirar?`
    });
  }

  // 4️⃣ Detectar productos
  const productosDetectados = detectarProducto(textoMensaje);

  if (productosDetectados.length > 0) {
    const nuevoCarrito = [...cliente.carrito, ...productosDetectados];

    await supabase
      .from("clientes_detallados")
      .update({ carrito: nuevoCarrito })
      .eq("whatsapp", from);

    return res.json({
      reply:
        "Anotado 💛\n\n" +
        productosDetectados
          .map(
            (p) =>
              `• ${p.cantidad} x ${p.nombre} ($${p.precio * p.cantidad})`
          )
          .join("\n") +
        "\n\n¿Algo más?"
    });
  }

  // 5️⃣ Resumen manual
  if (textoMensaje.toLowerCase().includes("resumen")) {
    const { total, envio } = calcularResumen(cliente.carrito);

    return res.json({
      reply:
        "Aquí va tu resumen 💛:\n\n" +
        cliente.carrito
          .map(
            (p) =>
              `• ${p.cantidad} x ${p.nombre} = $${p.cantidad * p.precio}`
          )
          .join("\n") +
        `\n\n🧾 Total: $${total}\n🚚 Envío: $${envio}\n\n¿Confirmas el pedido?`
    });
  }

  // 6️⃣ Confirmar pedido
  if (
    textoMensaje.toLowerCase().includes("confirmo") ||
    textoMensaje.toLowerCase().includes("acepto") ||
    textoMensaje.toLowerCase().includes("confirmado")
  ) {
    const { total, envio } = calcularResumen(cliente.carrito);

    await supabase.from("pedidos_completos").insert({
      whatsapp: from,
      nombre: cliente.nombre,
      comuna: cliente.comuna,
      direccion: cliente.direccion,
      telefono: cliente.telefono_adicional || from,
      carrito: cliente.carrito,
      total,
      envio,
      confirmado: true
    });

    return res.json({
      reply: "¡Perfecto! Tu pedido quedó agendado 💛\n✔️"
    });
  }

  // 7️⃣ GPT si no calza en nada más
  const respuesta = await responderGPT(textoMensaje, [], cliente);

  return res.json({ reply: respuesta });
});

// 🟣 SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Luna Bot iniciado en puerto ${PORT}`)
);
