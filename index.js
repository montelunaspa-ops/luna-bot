// ================================================
//  LUNA BOT - INDEX.JS FINAL Y ESTABLE
// ================================================

require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");

const { iniciarFlujo, procesarPaso } = require("./flow");
const { guardarHistorial } = require("./dbSave");

// ================================================
//  1. CONFIGURACIÓN EXPRESS (OBLIGATORIA PARA WHATSauto)
// ================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // <-- NECESARIO PARA WHATSAUTO

// ================================================
//  2. MEMORIA TEMPORAL EN RAM
// ================================================
const sesiones = {}; // { telefono: {state} }

// ================================================
//  3. RUTA PRINCIPAL DEL WEBHOOK
// ================================================
app.post("/whatsapp", async (req, res) => {
  try {
    // WhatsAuto envía FORM-URLENCODED → req.body funciona con urlencoded
    console.log("🟣 BODY DECODIFICADO:", req.body);

    const { phone, message } = req.body;

    // Validación mínima
    if (!phone || !message) {
      console.log("❌ ERROR: Falta phone o message en el payload.");
      return res.json({ reply: "No entendí el mensaje 😅" });
    }

    // Guardar historial (no detiene flujo si falla)
    try {
      await guardarHistorial(phone, message, "cliente");
    } catch (e) {
      console.log("❌ Error guardando historial:", e);
    }

    // Recuperar o crear nueva sesión
    if (!sesiones[phone]) {
      sesiones[phone] = iniciarFlujo({}, phone);
      console.log("🆕 Nueva sesión creada:", phone);
    }

    const state = sesiones[phone];

    // Procesar mensaje
    const respuesta = await procesarPaso(state, message);

    // Guardar historial del bot
    try {
      await guardarHistorial(phone, respuesta, "bot");
    } catch (e) {
      console.log("❌ Error guardando historial:", e);
    }

    // Responder a WhatsAuto
    return res.json({ reply: respuesta });

  } catch (error) {
    console.log("❌ ERROR EN /whatsapp:", error);
    return res.json({
      reply: "Lo siento 😔 ocurrió un error inesperado. Intenta nuevamente."
    });
  }
});

// ================================================
//  4. PUERTO PARA RENDER
// ================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
});
