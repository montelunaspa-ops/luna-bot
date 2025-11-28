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

app.get("/", (req, res) => {
  res.send("🚀 Luna Bot funcionando 💛");
});

app.post("/whatsapp", async (req, res) => {
  console.log("📩 Mensaje recibido:", req.body);

  const { phone, message, type, mediaUrl } = req.body;

  if (!phone) {
    return res.json({
      reply:
        "No pude leer tu número 💛. Revisa la configuración de WhatsAuto."
    });
  }

  let texto = (message || "").toLowerCase().trim();
  const whatsapp = phone.trim();

  if (type === "voice" && mediaUrl) {
    texto = (await transcribirAudio(mediaUrl)).toLowerCase();
  }

  let { data: cliente } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("whatsapp", whatsapp)
    .single();

  let nuevoCliente = false;

  if (!cliente) {
    const { data } = await supabase
      .from("clientes_detallados")
      .insert({ whatsapp, comuna: null, carrito: [] })
      .select()
      .single();

    cliente = data;
    nuevoCliente = true;
  }

  if (
    nuevoCliente ||
    texto.includes("hola") ||
    texto.includes("buenas")
  ) {
    return res.json({
      reply:
        rules.catalogo_completo +
        "\n\n¿En qué comuna necesitas el despacho?"
    });
  }

  const palabrasCatalogo = ["catalogo", "catálogo", "ver", "menu"];
  if (palabrasCatalogo.some((p) => texto.includes(p))) {
    return res.json({ reply: rules.catalogo_completo });
  }

  if (!cliente.comuna) {
    const c = validarComuna(texto);

    if (!c.reparto) {
      return res.json({
        reply:
          `Aún no tenemos reparto en *${texto}* 😔\n` +
          `Puedes retirar en:\n${rules.retiro_domicilio}`
      });
    }

    await supabase
      .from("clientes_detallados")
      .update({ comuna: texto })
      .eq("whatsapp", whatsapp);

    return res.json({
      reply: `Perfecto 💛 hacemos reparto en *${texto}*.\nHorario: ${c.horario} hrs.\n\n¿Qué deseas pedir?`
    });
  }

  const productos = detectarProducto(texto);

  if (productos.length > 0) {
    const nuevoCarrito = [...cliente.carrito, ...productos];

    await supabase
      .from("clientes_detallados")
      .update({ carrito: nuevoCarrito })
      .eq("whatsapp", whatsapp);

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

  if (texto.includes("resumen") || texto.includes("ver pedido")) {
    const { total, envio } = calcularResumen(cliente.carrito);

    return res.json({
      reply:
        "Aquí está tu resumen 💛\n\n" +
        cliente.carrito
          .map(
            (p) =>
              `• ${p.cantidad} x ${p.nombre} = $${p.cantidad * p.precio}`
          )
          .join("\n") +
        `\n\nTotal: $${total}\nEnvío: $${envio}\n\n¿Confirmas?`
    });
  }

  if (
    texto.includes("confirmo") ||
    texto.includes("acepto")
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

  const respuesta = await responderGPT(texto, cliente);
  return res.json({ reply: respuesta });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Luna Bot en puerto " + PORT));
