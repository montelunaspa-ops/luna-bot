import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------------------------------
// LOG de cada request (Render lo muestra)
// ---------------------------------------
app.use((req, res, next) => {
  console.log("📩 Nueva petición:", {
    body: req.body,
    method: req.method,
    url: req.url,
  });
  next();
});

// ---------------------------------------
// OBTENER CLIENTE DESDE LA BD
// ---------------------------------------
async function obtenerCliente(phone) {
  const { data, error } = await supabase
    .from("clientes_detallados")
    .select("*")
    .eq("telefono", phone)
    .maybeSingle();

  if (error) {
    console.error("❌ Error obteniendo cliente:", error);
    return null;
  }

  return data;
}

// ---------------------------------------
// GUARDAR HISTORIAL
// ---------------------------------------
async function guardarHistorial(phone, rol, mensaje) {
  await supabase.from("historial").insert({
    telefono: phone,
    rol: rol,
    mensaje: mensaje,
    fecha: new Date(),
  });
}

// ---------------------------------------
// GUARDAR PEDIDO
// ---------------------------------------
async function guardarPedido(phone, detalle) {
  await supabase.from("pedidos").insert({
    telefono: phone,
    detalle: detalle,
    fecha: new Date(),
  });
}

// ---------------------------------------
// FLUJO PRINCIPAL
// ---------------------------------------
async function procesarMensaje(phone, mensaje) {
  mensaje = mensaje?.trim()?.toLowerCase() || "";

  // Guardar en historial (cliente → bot)
  await guardarHistorial(phone, "cliente", mensaje);

  // Buscar cliente
  const cliente = await obtenerCliente(phone);

  // ----------------------------------------------------
  // SI NO EXISTE, REGISTRAR AUTOMÁTICAMENTE AL CLIENTE
  // ----------------------------------------------------
  if (!cliente) {
    console.log("🧾 Cliente nuevo, registrándolo...");

    await supabase.from("clientes_detallados").insert({
      telefono: phone,
      nombre: "Sin nombre",
      direccion: "Sin dirección",
      ciudad: "Sin ciudad",
      creado: new Date(),
    });

    const respuesta =
      "👋 ¡Hola! Te doy la bienvenida.\nYa estás registrado como cliente.\n\n¿En qué puedo ayudarte hoy? 😊";

    await guardarHistorial(phone, "bot", respuesta);

    return respuesta;
  }

  // ----------------------------------------------------
  // SI EXISTE CLIENTE → TOMAR PEDIDO DIRECTO
  // ----------------------------------------------------
  if (mensaje.includes("pedido") || mensaje.includes("queque") || mensaje.includes("quiero")) {
    return "Perfecto 😊 ¿Qué producto deseas pedir exactamente?";
  }

  // CONFIRMAR PEDIDO
  if (mensaje.includes("confirmo") || mensaje.includes("sí confirmo")) {
    await guardarPedido(phone, "Pedido confirmado");
    const respuesta = "¡Pedido confirmado! ✔️";
    await guardarHistorial(phone, "bot", respuesta);
    return respuesta;
  }

  // SI EL MENSAJE ES LIBRE
  return "😊 Estoy aquí para ayudarte. ¿Qué deseas pedir hoy?";
}

// ---------------------------------------
// ENDPOINT PRINCIPAL /whatsapp
// Compatible con WhatsAuto
// ---------------------------------------
app.post("/whatsapp", async (req, res) => {
  try {
    const phone = req.body.phone?.trim();
    const mensaje = req.body.message?.trim();

    if (!phone || !mensaje) {
      console.log("⚠️ Request inválido recibido:", req.body);
      return res.json({
        reply: "No pude procesar tu mensaje. Intenta nuevamente.",
      });
    }

    const respuesta = await procesarMensaje(phone, mensaje);

    // Guardar respuesta en historial
    await guardarHistorial(phone, "bot", respuesta);

    return res.json({ reply: respuesta });
  } catch (error) {
    console.error("❌ Error en /whatsapp:", error);
    return res.json({
      reply: "Ocurrió un error procesando tu mensaje.",
    });
  }
});

// ---------------------------------------
app.get("/", (req, res) => {
  res.send("WhatsApp Bot funcionando ✔️");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor activo en puerto ${PORT}`));
