require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { iniciarFlujo, procesarPaso } = require("./flow");
const { guardarHistorial } = require("./dbSave");

const app = express();
const PORT = process.env.PORT || 3000;

// WhatsAuto envía application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Sesiones por número de teléfono
const sesiones = {};

function obtenerSesion(phone) {
  if (!sesiones[phone]) {
    console.log("🆕 Nueva sesión creada:", phone);
    sesiones[phone] = iniciarFlujo({}, phone);
  }
  return sesiones[phone];
}

/* ============================================
   ENDPOINT WHATSAPP (WebHook de WhatsAuto)
============================================ */
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("🟣 BODY DECODIFICADO:", req.body);

    const { phone, message } = req.body;

    if (!phone || !message) {
      console.log("❌ Payload incompleto, falta phone o message");
      return res.json({ reply: "Hubo un problema con el formato del mensaje." });
    }

    const state = obtenerSesion(phone);

    // Guardamos mensaje del cliente
    await guardarHistorial(phone, message, "cliente");

    // Procesamos con el flujo
    const respuesta = await procesarPaso(state, message);

    // Guardamos respuesta del bot
    await guardarHistorial(phone, respuesta, "bot");

    console.log("🤖 RESPUESTA DEL BOT:", respuesta);

    return res.json({ reply: respuesta });
  } catch (e) {
    console.error("❌ ERROR EN /whatsapp:", e);
    return res.json({
      reply: "Ocurrió un error al procesar tu mensaje, por favor intenta de nuevo."
    });
  }
});

/* ============================================
   SERVIDOR
============================================ */
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
});
