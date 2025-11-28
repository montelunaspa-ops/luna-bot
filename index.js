import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { procesarFlujo } from "./gpt.js";
import { transcribirAudio } from "./audio.js";
import { calcularResumen } from "./helpers.js";

const app = express();
app.use(bodyParser.json());

app.get("/", (req, res) => res.send("Luna Bot funcionando 💛"));

app.post("/whatsapp", async (req, res) => {
  const { phone, message, type, mediaUrl } = req.body;

  if (!phone) {
    return res.json({ reply: "No pude leer tu número 💛" });
  }

  let texto = (message || "").toLowerCase().trim();

  if (type === "voice" && mediaUrl) {
    texto = await transcribirAudio(mediaUrl);
  }

  let { data: cliente } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("whatsapp", phone)
    .single();

  if (!cliente) {
    const nuevo = await supabase
      .from("clientes_detallados")
      .insert({
        whatsapp: phone,
        estado: "esperando_comuna",
        comuna: null,
        carrito: [],
        nombre: null,
        direccion: null,
        telefono_adicional: null
      })
      .select()
      .single();

    cliente = nuevo.data;
  }

  const respuestaGPT = await procesarFlujo(texto, cliente);

  if (respuestaGPT.actualizar && Object.keys(respuestaGPT.actualizar).length) {
    await supabase
      .from("clientes_detallados")
      .update({ ...respuestaGPT.actualizar, estado: respuestaGPT.estado })
      .eq("whatsapp", phone);
  }

  if (respuestaGPT.accion === "guardar_pedido") {
    const { total, envio } = calcularResumen(cliente.carrito);

    await supabase.from("pedidos_completos").insert({
      whatsapp: phone,
      comuna: cliente.comuna,
      carrito: cliente.carrito,
      total,
      envio,
      confirmado: true
    });
  }

  return res.json({ reply: respuestaGPT.respuesta });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Luna Bot listo en puerto " + PORT));
