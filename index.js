require("dotenv").config();
const express = require("express");
const app = express();

// Capturar rawBody ANTES de los parsers
app.use((req, res, next) => {
  let data = "";
  req.setEncoding("utf8");

  req.on("data", chunk => {
    data += chunk;
  });

  req.on("end", () => {
    req.rawBody = data;
    next();
  });
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const { iniciarFlujo, procesarPaso } = require("./flow");
const { guardarHistorial } = require("./dbSave");

// Sesiones en memoria
const sesiones = {};

function decodificarBody(rawBody) {
  try {
    const params = new URLSearchParams(rawBody);
    const obj = {};
    for (const [key, value] of params.entries()) {
      obj[key] = decodeURIComponent(value.replace(/\+/g, " "));
    }
    return obj;
  } catch (e) {
    return null;
  }
}

app.post("/whatsapp", async (req, res) => {
  let body = req.body;

  // Si WhatsAuto NO envió JSON → usar rawBody
  if (!body || Object.keys(body).length === 0) {
    if (req.rawBody) {
      body = decodificarBody(req.rawBody);
    }
  }

  if (!body) {
    console.log("❌ ERROR: No se pudo interpretar el body");
    return res.json({ reply: "Hubo un error procesando tu mensaje." });
  }

  const phone = body.phone;
  const message = body.message || "";

  if (!phone) {
    console.log("❌ ERROR: WhatsAuto no envió phone.");
    return res.json({ reply: "Error de formato recibido." });
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

  // Guardar respuesta del bot
  await guardarHistorial(phone, respuesta, "bot");

  res.json({ reply: respuesta });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor iniciado en el puerto ${PORT}`));
