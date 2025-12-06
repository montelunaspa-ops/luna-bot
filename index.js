require("dotenv").config();
const express = require("express");
const app = express();

const { iniciarFlujo, procesarPaso } = require("./flow");
const { guardarHistorial } = require("./dbSave");

// ===========================================================
// 🟣 CAPTURAR RAW BODY (WHATAUTO LO NECESITA)
// ===========================================================
app.use((req, res, next) => {
  let raw = "";
  req.on("data", chunk => (raw += chunk));
  req.on("end", () => {
    req.rawBody = raw;
    next();
  });
});

// ===========================================================
// 🟣 PARSERS NORMALES
// ===========================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sesiones en memoria
const sesiones = {};

// ===========================================================
// 🟣 Decodificar mensajes x-www-form-urlencoded
// ===========================================================
function decodificarBody(rawBody) {
  try {
    const params = new URLSearchParams(rawBody);
    const obj = {};
    for (const [key, value] of params.entries()) {
      obj[key] = decodeURIComponent(value.replace(/\+/g, " "));
    }
    return obj;
  } catch {
    return null;
  }
}

// ===========================================================
// 🟣 Endpoint WhatsApp
// ===========================================================
app.post("/whatsapp", async (req, res) => {
  let body = req.body;

  // WhatsAuto manda body vacío → usar rawBody
  if (!body || Object.keys(body).length === 0) {
    const raw = req.rawBody?.toString();
    if (raw) body = decodificarBody(raw);
  }

  if (!body) {
    console.log("❌ ERROR: Body vacío");
    return res.json({ reply: "Hubo un error procesando tu mensaje." });
  }

  const phone = body.phone;
  const message = body.message || "";

  if (!phone) {
    console.log("❌ ERROR: WhatsAuto no envió el número del cliente");
    return res.json({ reply: "Error: falta teléfono." });
  }

  // Guardar historial
  await guardarHistorial(phone, message, "cliente");

  // Crear sesión si no existe
  if (!sesiones[phone]) {
    sesiones[phone] = iniciarFlujo({}, phone);
  }

  const state = sesiones[phone];

  // Procesar mensaje
  const respuesta = await procesarPaso(state, message);

  // Guardar historial del bot
  await guardarHistorial(phone, respuesta, "bot");

  res.json({ reply: respuesta });
});

// ===========================================================
// 🟣 Inicio del servidor
// ===========================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor iniciado en el puerto ${PORT}`));
