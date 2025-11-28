import express from "express";
import { supabase } from "./supabaseClient.js";
import { responderGPT } from "./gpt.js";
import { extraerMensaje } from "./audio.js";
import { limpiarMensaje } from "./format.js";
import { obtenerContextoFlujo } from "./flow.js";

const app = express();
app.use(express.json());

app.post("/whatsapp", async (req, res) => {
  try {
    const body = req.body;
    const telefono = body.from;
    const mensaje = limpiarMensaje(extraerMensaje(body));

    let { data: cliente } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("telefono", telefono)
      .single();

    if (!cliente) {
      const nuevo = {
        telefono: telefono,
        es_cliente: false,
        fecha_registro: new Date(),
      };

      const { data: insertado } = await supabase
        .from("clientes_detallados")
        .insert(nuevo)
        .select()
        .single();

      cliente = insertado;
    }

    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("telefono", telefono)
      .order("fecha", { ascending: true });

    const contexto = obtenerContextoFlujo(historial || []);

    const respuesta = await responderGPT(mensaje, cliente, contexto);

    await supabase.from("historial").insert({
      telefono,
      mensaje_usuario: mensaje,
      respuesta_bot: respuesta,
      fecha: new Date(),
    });

    res.json({ reply: respuesta });

  } catch (error) {
    console.error("LunaBot Error:", error);
    return res.json({ reply: "Ocurrió un error, intenta nuevamente." });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log("Luna Bot corriendo...")
);
