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
// BOT WHATSAPP
// ------------------------------------------------------
app.post("/whatsapp", async (req, res) => {
  console.log("📩 Mensaje recibido:", req.body);

  const { phone, message, type, mediaUrl } = req.body;

  if (!phone) {
    return res.json({
      reply:
        "No pude leer tu número 💛.\nRevisa que WhatsAuto tenga activada la opción *Enviar número del remitente*."
    });
  }

  let texto = (message || "").toLowerCase().trim();
  const whatsapp = phone.trim();

  // TRANSCRIPCIÓN DE AUDIO
  if (type === "voice" && mediaUrl) {
    texto = (await transcribirAudio(mediaUrl)).toLowerCase();
  }

  // ------------------------------------------------------
  // 1. BUSCAR O CREAR CLIENTE
  // ------------------------------------------------------
  let { data: cliente } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("whatsapp", whatsapp)
    .single();

  let nuevoCliente = false;

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

  // ------------------------------------------------------
  // 2. SALUDO O CLIENTE NUEVO → ENVIAR CATÁLOGO
  // ------------------------------------------------------
  const saludo = [
    "hola",
    "buenas",
    "buenos días",
    "buenas tardes",
    "buenas noches"
  ];

  if (nuevoCliente || saludo.some((s) => texto === s || texto.includes(s))) {
    return res.json({
      reply:
        rules.catalogo_completo +
        "\n\n💛 ¿En qué comuna necesitas el despacho?"
    });
  }

  // ------------------------------------------------------
  // 3. DETECCIÓN DE “CATÁLOGO”
  // ------------------------------------------------------
  const palabrasCatalogo = [
    "catalogo",
    "catálogo",
    "ver menú",
    "menu",
    "ver catalogo",
    "ver el catalogo",
    "mostrar catalogo"
  ];

  if (palabrasCatalogo.some((p) => texto.includes(p))) {
    return res.json({
      reply: rules.catalogo_completo
    });
  }

  // ------------------------------------------------------
  // 4. VALIDAR COMUNA
  // ------------------------------------------------------
  if (!cliente.comuna) {
    const comuna = validarComuna(texto);

    // ✔ COMUNA VÁLIDA
    if (comuna.reparto) {
      await supabase
        .from("clientes_detallados")
        .update({ comuna: texto })
        .eq("whatsapp", whatsapp);

      return res.json({
        reply:
          `Perfecto 💛 hacemos reparto en *${texto}*.\n` +
          `Horario estimado: ${comuna.horario} hrs.\n\n` +
          "¿Qué deseas pedir?"
      });
    }

    // ❌ COMUNA NO VÁLIDA → OFRECER RETIRO
    return res.json({
      reply:
        `Lo siento 💛, aún no tenemos reparto en *${texto}*.\n\n` +
        `📍 Puedes retirar en nuestro domicilio:\n${rules.retiro_domicilio}\n\n` +
        "¿Deseas retirar en domicilio?"
    });
  }

  // ------------------------------------------------------
  // 4.1 DETECTAR RESPUESTA DE RETIRO
  // ------------------------------------------------------
  if (cliente.comuna === null) {
    if (
      texto.includes("si") ||
      texto.includes("sí") ||
      texto.includes("quiero retirar") ||
      texto.includes("retirar") ||
      texto.includes("retiro")
    ) {
      await supabase
        .from("clientes_detallados")
        .update({ comuna: "retiro" })
        .eq("whatsapp", whatsapp);

      return res.json({
        reply:
          "Perfecto 💛 tu pedido será para *retiro* en Calle Chacabuco 1120.\n\n" +
          "¿Qué deseas pedir?"
      });
    }
  }

  // ------------------------------------------------------
  // 5. DETECCIÓN DE PRODUCTOS
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
  // 6. RESUMEN
  // ------------------------------------------------------
  if (
    texto.includes("resumen") ||
    texto.includes("ver pedido") ||
    texto.includes("que pedí")
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

  // ------------------------------------------------------
  // 7. CONFIRMACIÓN FINAL
  // ------------------------------------------------------
  if (
    texto.includes("confirmo") ||
    texto.includes("acepto") ||
    texto.includes("si confirmo")
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

  // ------------------------------------------------------
  // 8. GPT (RESPUESTAS GENERALES)
  // ------------------------------------------------------
  const respuesta = await responderGPT(texto, cliente);
  return res.json({ reply: respuesta });
});

// ------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Luna Bot listo en puerto:", PORT);
});
