require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const qs = require("qs");

const flow = require("./flow");
const { guardarHistorial } = require("./dbSave");

const app = express();
app.use(bodyParser.text({ type: "*/*" }));

// Sesiones por número → NO usa express-session
const sesiones = {};

/* ============================================================
   🟣 DECODIFICAR FORMATO WHATAUTO (x-www-form-urlencoded)
   ============================================================ */
function parsearWhatsAuto(body) {
  try {
    const parsed = qs.parse(body);
    return {
      app: parsed.app || "",
      sender: parsed.sender || "",
      phone: parsed.phone || "",
      message: parsed.message || "",
      type: "text"
    };
  } catch (e) {
    console.log("❌ ERROR interpretando WhatsAuto:", e);
    return null;
  }
}

/* ============================================================
   🟢 ENDPOINT PRINCIPAL
   ============================================================ */
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("🟣 BODY CRUDO RECIBIDO:", req.body);

    const data = parsearWhatsAuto(req.body);

    if (!data || !data.phone || !data.message) {
      console.log("❌ Payload inválido");
      return res.json({ reply: "No pude entender el mensaje 😅" });
    }

    console.log("🟣 BODY DECODIFICADO:", data);

    const phone = data.phone;
    const message = data.message;

    /* ============================================================
       🟢 Registrar historial de entrada
       ============================================================ */
    await guardarHistorial(phone, message, "cliente");

    /* ============================================================
       🟢 Crear sesión si no existe
       ============================================================ */
    if (!sesiones[phone]) {
      sesiones[phone] = flow.iniciarFlujo({}, phone);
      console.log("🆕 Nueva sesión creada:", phone);
    }

    const state = sesiones[phone];

    /* ============================================================
       🟢 Llamar al flujo del bot
       ============================================================ */
    const respuesta = await flow.procesarPaso(state, message);

    console.log("🤖 RESPUESTA DEL BOT:", respuesta);

    /* ============================================================
       🟢 Registrar historial de salida
       ============================================================ */
    await guardarHistorial(phone, respuesta, "bot");

    return res.json({ reply: respuesta });
  } catch (err) {
    console.log("❌ ERROR EN /whatsapp:", err);
    return res.json({ reply: "Ocurrió un error procesando tu mensaje 😢" });
  }
});

/* ============================================================
   🟢 PUERTO PARA RENDER
   ============================================================ */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
});
