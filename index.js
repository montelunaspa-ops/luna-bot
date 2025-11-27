import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { transcribirAudio } from "./audio.js";
import { responderGPT } from "./gpt.js";
import rules from "./rules.json" assert { type: "json" };
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

/* ----------------------------------------
   0️⃣  ENDPOINT ROOT
----------------------------------------- */
app.get("/", (req, res) => {
  res.send("🚀 Luna Bot está funcionando correctamente.");
});

/* ----------------------------------------
   1️⃣  ENDPOINT PRINCIPAL WHATSAPP
----------------------------------------- */
app.post("/whatsapp", async (req, res) => {
  console.log("📩 [WEBHOOK] Mensaje recibido:", req.body);

  const { phone, message, type, mediaUrl } = req.body;

  // Validación crítica: phone debe venir obligatoriamente
  if (!phone || phone.trim() === "") {
    console.log("❌ ERROR: WhatsAuto no envió el número del cliente.");
    return res.json({
      reply:
        "Lo siento 💛, no recibí tu número. Revisa la configuración de WhatsAuto (debe enviar {sender} como 'phone')."
    });
  }

  const from = phone.trim();
  let textoMensaje = message || "";

  /* ----------------------------------------
      2️⃣  NOTAS DE VOZ
  ----------------------------------------- */
  if (type === "voice" && mediaUrl) {
    try {
      textoMensaje = await transcribirAudio(mediaUrl);
      console.log("🎙 Transcripción:", textoMensaje);
    } catch (e) {
      console.log("❌ Error transcribiendo:", e);
      textoMensaje = "[No se pudo transcribir audio]";
    }
  }

  /* ----------------------------------------
      3️⃣  BUSCAR / CREAR CLIENTE
  ----------------------------------------- */
  let { data: cliente } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("whatsapp", from)
    .single();

  let nuevoCliente = false;

  if (!cliente) {
    console.log("🆕 Cliente nuevo. Creando registro...");
    const { data: newCli, error: cliError } = await supabase
      .from("clientes_detallados")
      .insert({
        whatsapp: from,
        carrito: []
      })
      .select()
      .single();

    if (cliError) {
      console.log("❌ Error creando cliente:", cliError);
      return res.json({
        reply: "Hubo un error registrándote 💛. Intenta nuevamente."
      });
    }

    cliente = newCli;
    nuevoCliente = true;
  }

  /* ----------------------------------------
      4️⃣  CLIENTE NUEVO → ENVIAR CATÁLOGO
  ----------------------------------------- */
  if (nuevoCliente) {
    return res.json({
      reply:
        rules.mensaje_bienvenida +
        "\n\n¿En qué comuna necesitas el despacho? 🚚"
    });
  }

  /* ----------------------------------------
      5️⃣  VALIDAR COMUNA
  ----------------------------------------- */
  if (!cliente.comuna) {
    const comunaDet = validarComuna(textoMensaje);

    if (comunaDet.reparto) {
      await supabase
        .from("clientes_detallados")
        .update({ comuna: textoMensaje.toLowerCase() })
        .eq("whatsapp", from);

      return res.json({
        reply:
          `Perfecto 💛 hacemos reparto en **${textoMensaje}**.\n` +
          `Horario estimado: **${comunaDet.horario}**.\n\n` +
          "¿Qué te gustaría pedir? 🍰"
      });
    }

    // comuna sin reparto
    return res.json({
      reply:
        `Por ahora no llegamos a **${textoMensaje}** 😢\n` +
        `Pero puedes retirar en nuestro domicilio:\n\n📍 ${rules.retiro_domicilio}\n\n¿Deseas retirar?`
    });
  }

  /* ----------------------------------------
      6️⃣  DETECTAR PRODUCTOS
  ----------------------------------------- */
  const productosDetectados = detectarProducto(textoMensaje);

  if (productosDetectados.length > 0) {
    const nuevoCarrito = [...cliente.carrito, ...productosDetectados];

    await supabase
      .from("clientes_detallados")
      .update({ carrito: nuevoCarrito })
      .eq("whatsapp", from);

    return res.json({
      reply:
        `Anotado 💛\n` +
        productosDetectados
          .map(
            (p) => `• ${p.cantidad} x ${p.nombre} ($${p.precio})`
          )
          .join("\n") +
        "\n\n¿Algo más?"
    });
  }

  /* ----------------------------------------
      7️⃣  SI EL CLIENTE ESCRIBE 'RESUMEN'
  ----------------------------------------- */
  if (textoMensaje.toLowerCase().includes("resumen")) {
    const { total, envio } = calcularResumen(cliente.carrito);

    return res.json({
      reply:
        "Aquí está tu resumen 💛:\n\n" +
        cliente.carrito
          .map(
            (p) =>
              `• ${p.cantidad} x ${p.nombre} = $${p.cantidad * p.precio}`
          )
          .join("\n") +
        `\n\n🧾 Total productos: $${total}\n🚚 Envío: $${envio}\n\n¿Confirmas el pedido?`
    });
  }

  /* ----------------------------------------
      8️⃣  CONFIRMAR PEDIDO
  ----------------------------------------- */
  if (
    textoMensaje.toLowerCase().includes("confirmo") ||
    textoMensaje.toLowerCase().includes("acepto")
  ) {
    const { total, envio } = calcularResumen(cliente.carrito);

    await supabase.from("pedidos_completos").insert({
      nombre: cliente.nombre,
      whatsapp: from,
      comuna: cliente.comuna,
      direccion: cliente.direccion,
      telefono: cliente.telefono || cliente.whatsapp,
      pedido: cliente.carrito,
      total,
      envio,
      confirmado: true
    });

    return res.json({
      reply:
        "¡Perfecto! Tu pedido quedó agendado 💛\n✔️"
    });
  }

  /* ----------------------------------------
      9️⃣  SI NO ES NADA DE LO ANTERIOR → GPT
  ----------------------------------------- */
  const respuesta = await responderGPT(textoMensaje, [], cliente);

  return res.json({ reply: respuesta });
});

/* ----------------------------------------
   SERVIDOR
----------------------------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("🚀 Luna Bot iniciado en puerto:", PORT)
);
