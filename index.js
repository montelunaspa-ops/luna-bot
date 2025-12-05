require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { iniciarFlujo, procesarPaso } = require("./flow");
const { guardarHistorial } = require("./dbSave");

const app = express();
const PORT = process.env.PORT || 3000;

// WhatsAuto envía x-www-form-urlencoded → necesitamos esto:
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Sesiones por teléfono
const sesiones = {};

function obtenerSesion(phone) {
  if (!sesiones[phone]) {
    console.log("🆕 Nueva sesión creada:", phone);
    sesiones[phone] = iniciarFlujo({}, phone);
  }
  return sesiones[phone];
}

/* ===========================================================
   ENDPOINT PRINCIPAL WHATSAPP
   =========================================================== */
app.post("/whatsapp", async (req, res) => {
  try {
    const raw = req.body;
    console.log("🟣 BODY DECODIFICADO:", raw);

    const phone = raw.phone;
    const message = raw.message;

    if (!phone || !message) {
      console.log("❌ Payload incompleto");
      return res.json({ reply: "Error de formato" });
    }

    const state = obtenerSesion(phone);

    await guardarHistorial(phone, message, "cliente");

    const respuesta = await procesarPaso(state, message);

    await guardarHistorial(phone, respuesta, "bot");

    console.log("🤖 RESPUESTA DEL BOT:", respuesta);

    res.json({ reply: respuesta });
  } catch (e) {
    console.log("❌ ERROR EN /whatsapp:", e);
    res.json({ reply: "Ocurrió un error, inténtalo nuevamente." });
  }
});

/* ===========================================================
   SERVIDOR
   =========================================================== */
app.listen(PORT, () =>
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`)
);
