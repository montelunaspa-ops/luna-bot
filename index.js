import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { transcribirAudio } from "./audio.js";
import { responderGPT } from "./gpt.js";
import rules from "./rules.js";
import {
  validarComuna,
  detectarProducto,
  calcularResumen
} from "./helpers.js";

// 👇 Nuevo import del clasificador GPT
import { clasificarMensaje } from "./classifier.js";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// HOME
app.get("/", (req, res) => {
  res.send("🚀 Luna Bot funcionando correctamente 💛");
});

// WEBHOOK WHATSAPP
app.post("/whatsapp", async (req, res) => {
  console.log("📩 Mensaje recibido:", req.body);

  const { phone, message, type, mediaUrl } = req.body;

  if (!phone) {
    return res.json({ reply: "No pude leer tu número 💛" });
  }

  let texto = (message || "").toLowerCase().trim();
  const whatsapp = phone.trim();

  // Notas de voz → texto
  if (type === "voice" && mediaUrl) {
    texto = (await transcribirAudio(mediaUrl)).toLowerCase();
  }

  // Buscar cliente
  let { data: cliente } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("whatsapp", whatsapp)
    .single();

  let nuevoCliente = false;

  // Crear si no existe
  if (!cliente) {
    const { data: creado } = await supabase
      .from("clientes_detallados")
      .insert({
        whatsapp,
        comuna: null,
        carrito: []
      })
      .select()
      .single();

    cliente = creado;
    nuevoCliente = true;
  }

  // ---------- 1. CLIENTE NUEVO O SALUDO → CATÁLOGO ----------
  const saludo = ["hola", "buenas", "buenos días", "buenas tardes", "buenas noches"];

  if (nuevoCliente || saludo.some((s) => texto === s || texto.includes(s))) {
    return res.json({
      reply:
        rules.catalogo_completo +
        "\n\n💛 ¿En qué comuna enviamos tu pedido?"
    });
  }

  // ---------- 2. CONSULTA DIRECTA DEL CATÁLOGO ----------
  const palabrasCatalogo = ["catalogo", "catálogo", "ver catálogo", "menu", "ver menu"];

  if (palabrasCatalogo.some((p) => texto.includes(p))) {
    return res.json({ reply: rules.catalogo_completo });
  }

  // ---------- 3. BLOQUE DE COMUNA (REEMPLAZADO POR GPT CLASSIFIER) ----------
  if (!cliente.comuna) {

    // 🧠 GPT decide qué tipo de mensaje envió el cliente
    const tipo = await clasificarMensaje(texto);

    // 1) Es una comuna válida
    if (tipo === "comuna_valida") {
      await supabase
        .from("clientes_detallados")
        .update({ comuna: texto })
        .eq("whatsapp", whatsapp);

      const horario = rules.horarios[texto];

      return res.json({
        reply:
          `Perfecto 💛 hacemos reparto en *${texto}*.\n` +
          `Horario estimado: ${horario}.\n\n` +
          "¿Qué deseas pedir?"
      });
    }

    // 2) Es una comuna inválida
    if (tipo === "comuna_invalida") {
      return res.json({
        reply:
          `Aún no tenemos reparto en *${texto}* 💛\n` +
          `📍 Puedes retirar en: ${rules.retiro_domicilio}\n\n` +
          "¿Deseas retiro?"
      });
    }

    // 3) Es una pregunta → Responder y retomar flujo
    if (tipo === "pregunta") {
      const resp = await responderGPT(texto, cliente);
      return res.json({
        reply: `${resp}\n\n💛 ¿En qué comuna enviamos tu pedido?`
      });
    }

    // 4) Es otro texto → pedir comuna de nuevo
    return res.json({
      reply: "Para continuar necesito tu comuna 💛"
    });
  }

  // ---------- 4. DETECCIÓN DE PRODUCTOS ----------
  const productos = detectarProducto(texto);

  if (productos.length > 0) {
    const nuevoCarrito = [...cliente.carrito, ...productos];

    await supabase
      .from("clientes_detallados")
      .update({ carrito: nuevoCarrito })
      .eq("whatsapp", whatsapp);

    return res.json({
      reply:
        "Perfecto 💛\n" +
        productos
          .map(
            (p) => `• ${p.cantidad} x ${p.nombre} = $${p.cantidad * p.precio}`
          )
          .join("\n") +
        "\n\n¿Algo más?"
    });
  }

  // ---------- 5. RESUMEN ----------
  if (
    texto.includes("resumen") ||
    texto.includes("ver pedido") ||
    texto.includes("qué pedí")
  ) {
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

  // ---------- 6. CONFIRMACIÓN FINAL ----------
  if (
    texto.includes("confirmo") ||
    texto.includes("acepto") ||
    texto.includes("sí confirmo")
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

    await supabase
      .from("clientes_detallados")
      .update({ carrito: [] })
      .eq("whatsapp", whatsapp);

    return res.json({
      reply: "¡Perfecto! Tu pedido quedó agendado 💛\n✔️"
    });
  }

  // ---------- 7. GPT COMO ÚLTIMO RECURSO ----------
  const respuesta = await responderGPT(texto, cliente);
  return res.json({ reply: respuesta });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Luna Bot listo en puerto:", PORT));
