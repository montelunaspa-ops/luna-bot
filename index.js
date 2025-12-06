require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");

const { nuevoEstado, procesarPaso } = require("./flow");
const { guardarHistorial } = require("./dbSave");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

/* Sesiones en memoria */
const sesiones = {};

/* ===========================================================
   🔵 WEBHOOK PRINCIPAL /whatsapp
=========================================================== */
app.post("/whatsapp", async (req, res) => {
  try {
    const telefono = req.body.phone;
    const mensaje = req.body.message;

    if (!telefono || !mensaje) {
      return res.json({ reply: "❌ Error: payload inválido." });
    }

    // Inicializar sesión si no existe
    if (!sesiones[telefono]) {
      sesiones[telefono] = nuevoEstado(telefono);
    }

    const state = sesiones[telefono];

    // Guardar historial
    await guardarHistorial(telefono, mensaje, "cliente");

    // Procesar flujo
    const respuesta = await procesarPaso(state, mensaje);

    // Guardar respuesta en historial
    await guardarHistorial(telefono, respuesta, "bot");

    return res.json({ reply: respuesta });
  } catch (err) {
    console.error("❌ Error en /whatsapp:", err);
    return res.json({ reply: "Ocurrió un error 😔 Intenta nuevamente." });
  }
});

/* Servidor */
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
});
