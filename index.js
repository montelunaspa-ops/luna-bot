// index.js — VERSIÓN 100% ESTABLE

import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { transcribirAudio } from "./audio.js";
import { responderGPT } from "./gpt.js";

import rules from "./rules.js";
import catalogo from "./catalogo.js";
import {
  validarComuna,
  detectarProducto,
  calcularResumen
} from "./helpers.js";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ------------------------------------------------------
// HOME
// ------------------------------------------------------
app.get("/", (req, res) => {
  res.send("🚀 Luna Bot funcionando correctamente 💛");
});

// ------------------------------------------------------
// BOT PRINCIPAL
// ------------------------------------------------------
app.post("/whatsapp", async (req, res) => {
  console.log("📩 Mensaje recibido:", req.body);

  const { phone, message, type, mediaUrl } = req.body;

  if (!phone) {
    return res.json({
      reply:
        "No pude leer tu número 💛. Revisa la configuración de WhatsAuto (activa 'enviar número del remitente')."
    });
  }

  let texto = (message || "").trim().toLowerCase();
  const whatsapp = phone.trim();

  // TRANSCRIPCIÓN
  if (type === "voice" && mediaUrl) {
    texto = (await transcribirAudio(mediaUrl)).toLowerCase();
  }

  // ------------------------------------------------------
  // BUSCAR O CREAR CLIENTE
  // ------------------------------------------------------
  let { data: cliente } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("whatsapp", whatsapp)
    .single();

  let nuevoCliente = false;

  if (!cliente) {
    const { data: c } = await supabase
      .from("clientes_detallados")
      .insert({
        whatsapp,
        comuna: null,
        carrito: []
      })
      .select()
      .single();

    cliente = c;
    nuevoCliente = true;
  }

  // ------------------------------------------------------
  // 1. CLIENTE NUEVO → ENVIAR CATÁLOGO + PEDIR COMUNA
  // ------------------------------------------------------
  if (nuevoCliente) {
    return res.json({
      reply:
        rules.mensaje_bienvenida +
        "\n\n¿En qué comuna necesitas el despacho?"
    });
  }

  // ------------------------------------------------------
  // ATAJAR PREGUNTAS COMO “CATÁLOGO”, “VER CATÁLOGO”, ETC.
  // (ANTES DE CUALQUIER OTRA LÓGICA)
  // ------------------------------------------------------
  const palabrasCatalogo = ["catalogo", "catálogo", "ver", "menu"];
  if (palabrasCatalogo.some((p) => texto.includes(p))) {
    return res.json({
      reply: rules.catalogo_completo
    });
  }

  // ------------------------------------------------------
  // 2. VALIDAR COMUNA
  // ------------------------------------------------------
  if (!cliente.comuna) {
    const c = validarComuna(texto);

    if (!c.reparto) {
      return res.json({
        reply:
          `Por ahora no tenemos reparto en *${texto}* 😔\n\n` +
          `Puedes retirar en:\n${rules.retiro_domicilio}\n\n` +
          "¿Deseas retirar?"
      });
    }

    await supabase
      .from("clientes_detallados")
      .update({ comuna: texto })
      .eq("whatsapp", whatsapp);

    return res.json({
      reply:
        `Perfecto 💛 hacemos reparto en *${texto}*.\n` +
        `Horario estimado: ${c.horario} hrs.\n\n` +
        "¿Qué deseas pedir?"
    });
  }

  // ------------------------------------------------------
  // 3. DETECTAR SI SON PRODUCTOS
  // ------------------------------------------------------
  const productos = detectarProducto(texto);

  if (productos.length > 0) {
    const nuevoCarrito = [...cliente.carrito, ...productos];

    await supabase
      .from("clientes_detallados")
      .update({ carrito: nuevoCarrito })
      .eq("whatsapp", whatsapp);

    return res.json({
      reply:
        "Anotado 💛\n\n" +
        productos
          .map(
            (p) =>
              `• ${p.cantidad} x ${p.nombre} → $${p.cantidad * p.precio}`
          )
          .join("\n") +
        "\n\n¿Algo más?"
    });
  }

  // ------------------------------------------------------
  // 4. RESUMEN
  // ------------------------------------------------------
  if (texto.includes("resumen") || texto.includes("ver pedido")) {
    const { total, envio } = calcularResumen(cliente.carrito);

    return res.json({
      reply:
        "Aquí tienes tu resumen 💛\n\n" +
        cliente.carrito
          .map(
            (p) =>
              `• ${p.cantidad} x ${p.nombre} = $${p.cantidad * p.precio}`
          )
          .join("\n") +
        `\n\nTotal productos: $${total}\nEnvío: $${envio}\n\n¿Confirmas?`
    });
  }

  // ------------------------------------------------------
  // 5. CONFIRMAR PEDIDO
  // ------------------------------------------------------
  if (
    texto.includes("confirmo") ||
    texto.includes("acepto") ||
    texto.includes("sí") && texto.includes("confirmo")
  ) {
    const { total, envio } = calcularResumen(cliente.carrito);

    await supabase.from("pedidos_completos").insert({
      whatsapp,
      comuna: cliente.comuna,
      carrito: cliente.carrito,
      total,
      envio,
      confirmado: true
    });

    // limpiar carrito
    await supabase
      .from("clientes_detallados")
      .update({ carrito: [] })
      .eq("whatsapp", whatsapp);

    return res.json({
      reply: "¡Perfecto! Tu pedido quedó agendado 💛\n✔️"
    });
  }

  // ------------------------------------------------------
  // 6. SI NO ENTRA EN NINGUNA LÓGICA → GPT RESPONDE
  // ------------------------------------------------------
  const respuesta = await responderGPT(texto, cliente);
  return res.json({ reply: respuesta });
});

// ------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Luna Bot listo en puerto:", PORT);
});
