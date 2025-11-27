// index.js
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

app.get("/", (req, res) => {
  res.send("🚀 Luna Bot está funcionando correctamente.");
});

app.post("/whatsapp", async (req, res) => {
  console.log("📩 Mensaje recibido:", req.body);

  const { phone, message, type, mediaUrl } = req.body;

  if (!phone) {
    return res.json({
      reply: "No pude leer tu número 💛. Revisa la configuración de WhatsAuto."
    });
  }

  const from = phone.trim();
  let texto = message || "";

  if (type === "voice" && mediaUrl) {
    texto = await transcribirAudio(mediaUrl);
  }

  // BUSCAR CLIENTE
  let { data: cliente } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("whatsapp", from)
    .single();

  let nuevo = false;

  if (!cliente) {
    const { data, error } = await supabase
      .from("clientes_detallados")
      .insert({
        whatsapp: from,
        comuna: null,
        carrito: []
      })
      .select()
      .single();

    if (error) {
      return res.json({ reply: "Error registrándote 💛. Intenta de nuevo." });
    }

    cliente = data;
    nuevo = true;
  }

  // CLIENTE NUEVO → CATÁLOGO
  if (nuevo) {
    return res.json({
      reply: rules.mensaje_bienvenida + "\n\n¿En qué comuna necesitas el despacho?"
    });
  }

  // VALIDAR COMUNA
  if (!cliente.comuna) {
    const c = validarComuna(texto);

    if (c.reparto) {
      await supabase
        .from("clientes_detallados")
        .update({ comuna: texto.toLowerCase() })
        .eq("whatsapp", from);

      return res.json({
        reply: `Perfecto 💛 hacemos reparto en *${texto}*. Horario estimado ${c.horario}. ¿Qué deseas pedir?`
      });
    }

    return res.json({
      reply:
        `Aún no llegamos a *${texto}* 😢\n` +
        `Pero puedes retirar en:\n${rules.retiro_domicilio}\n\n¿Deseas retirar?`
    });
  }

  // DETECTAR PRODUCTOS
  const productos = detectarProducto(texto);
  if (productos.length > 0) {
    const nuevoCarrito = [...cliente.carrito, ...productos];

    await supabase
      .from("clientes_detallados")
      .update({ carrito: nuevoCarrito })
      .eq("whatsapp", from);

    return res.json({
      reply:
        "Anotado 💛\n" +
        productos
          .map(
            (p) =>
              `• ${p.cantidad} x ${p.nombre} → $${p.cantidad * p.precio}`
          )
          .join("\n") +
        "\n\n¿Algo más?"
    });
  }

  // RESUMEN
  if (texto.toLowerCase().includes("resumen")) {
    const { total, envio } = calcularResumen(cliente.carrito);

    return res.json({
      reply:
        "Aquí va tu resumen 💛\n\n" +
        cliente.carrito
          .map(
            (p) =>
              `• ${p.cantidad} x ${p.nombre} = $${p.cantidad * p.precio}`
          )
          .join("\n") +
        `\n\nTotal productos: $${total}\nEnvío: $${envio}\n\n¿Confirmas?`
    });
  }

  // CONFIRMAR
  if (
    texto.toLowerCase().includes("confirmo") ||
    texto.toLowerCase().includes("acepto")
  ) {
    const { total, envio } = calcularResumen(cliente.carrito);

    await supabase.from("pedidos_completos").insert({
      whatsapp: from,
      comuna: cliente.comuna,
      carrito: cliente.carrito,
      total,
      envio,
      confirmado: true
    });

    return res.json({
      reply: "¡Perfecto! Tu pedido quedó agendado 💛\n✔️"
    });
  }

  // GPT
  const respuesta = await responderGPT(texto, cliente);
  return res.json({ reply: respuesta });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Luna Bot en puerto " + PORT));
