require("dotenv").config();
const express = require("express");
const app = express();

const { iniciarFlujo, procesarPaso } = require("./flow");
const { guardarHistorial } = require("./dbSave");

/* =======================================================
   NORMALIZAR TELÉFONO (SOLUCIÓN DEFINITIVA)
   ======================================================= */
function sanitizePhone(rawPhone) {
  if (!rawPhone) return "";

  // eliminar espacios
  let phone = rawPhone.trim().replace(/\s+/g, "");

  // asegurar que tenga +
  if (!phone.startsWith("+")) {
    phone = "+" + phone.replace(/^\+?/, "");
  }

  return phone;
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const sesiones = {};

function decodificarBody(raw) {
  try {
    const params = new URLSearchParams(raw);
    const obj = {};
    for (const [key, value] of params.entries()) {
      obj[key] = decodeURIComponent(value.replace(/\+/g, " "));
    }
    return obj;
  } catch {
    return null;
  }
}

app.post("/whatsapp", async (req, res) => {
  let body = req.body;

  // Cuando WhatsAuto NO envía JSON
  if (!body || Object.keys(body).length === 0) {
    const raw = req.rawBody?.toString();
    if (raw) body = decodificarBody(raw);
  }

  console.log("📩 BODY RECIBIDO:", body);

  if (!body) {
    console.log("❌ ERROR: body vacío");
    return res.json({ reply: "Error procesando mensaje." });
  }

  // 🔥 NORMALIZAR TELÉFONO
  const phone = sanitizePhone(body.phone);
  const message = body.message || "";

  console.log("📩 MENSAJE:", { phone, message });

  if (!phone) {
    console.log("❌ ERROR: phone vacío");
    return res.json({ reply: "Error: no se recibió número." });
  }

  // Guardar historial de entrada
  await guardarHistorial(phone, message, "cliente");

  // Crear sesión si no existe
  if (!sesiones[phone]) {
    sesiones[phone] = iniciarFlujo({}, phone);
  }

  const state = sesiones[phone];

  // Procesar mensaje del cliente
  const respuesta = await procesarPaso(state, message);

  // Guardar historial de salida
  await guardarHistorial(phone, respuesta, "bot");

  res.json({ reply: respuesta });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor iniciado en el puerto ${PORT}`));
