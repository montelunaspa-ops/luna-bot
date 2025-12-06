require("dotenv").config();
const express = require("express");
const app = express();

const { iniciarFlujo, procesarPaso } = require("./flow");
const { guardarHistorial } = require("./dbSave");

// WhatsAuto envía application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Sesiones en memoria
const sesiones = {};

// Conversión manual porque WhatsAuto envía espacios como "+"
function normalizarTexto(t) {
  if (!t) return "";
  return decodeURIComponent(t.replace(/\+/g, " "));
}

app.post("/whatsapp", async (req, res) => {
  let body = req.body;

  if (!body) {
    console.log("❌ BODY vacío");
    return res.json({ reply: "No pude leer tu mensaje 😅" });
  }

  const phone = normalizarTexto(body.phone);
  const message = normalizarTexto(body.message);

  console.log("📩 BODY RECIBIDO:", body);
  console.log("📩 MENSAJE:", { phone, message });

  if (!phone) {
    console.log("❌ ERROR: WhatsAuto no envió phone");
    return res.json({ reply: "Error: no se recibió número." });
  }

  // Guardar historial
  await guardarHistorial(phone, message, "cliente");

  // Crear sesión si no existe
  if (!sesiones[phone]) {
    sesiones[phone] = iniciarFlujo({}, phone);
  }

  const state = sesiones[phone];

  // Procesar flujo
  const respuesta = await procesarPaso(state, message);

  // Guardar historial del bot
  await guardarHistorial(phone, respuesta, "bot");

  return res.json({ reply: respuesta });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor iniciado en el puerto ${PORT}`));
