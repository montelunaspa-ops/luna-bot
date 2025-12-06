require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const decode = require("./decode");
const { iniciarFlujo, procesarPaso } = require("./flow");
const {
  guardarHistorial,
} = require("./dbSave");

const app = express();
app.use(bodyParser.text({ type: "*/*" }));

// Sesiones en memoria
const sesiones = {};

app.post("/whatsapp", async (req, res) => {
  try {
    const raw = req.body || "";
    console.log("🟣 BODY CRUDO RECIBIDO:", raw);

    const data = decode(raw);
    console.log("🟣 BODY DECODIFICADO:", data);

    const phone = data.phone;
    const mensaje = data.message;

    if (!phone || !mensaje) {
      return res.json({ reply: "Mensaje inválido recibido." });
    }

    console.log("📩 MENSAJE RECIBIDO:", { phone, message: mensaje });

    // 🔒 Mantener sesión existente
    if (!sesiones[phone]) {
      sesiones[phone] = iniciarFlujo({}, phone);
      console.log("🆕 Nueva sesión creada:", phone);
    } else {
      console.log("🔄 Sesión existente:", phone, " STEP:", sesiones[phone].step);
    }

    const state = sesiones[phone];

    // Guardar historial (pero no detener flujo si falla)
    guardarHistorial(phone, mensaje, "cliente").catch(() =>
      console.log("⚠️ No se pudo guardar historial.")
    );

    // Procesar mensaje con el flujo
    const respuesta = await procesarPaso(state, mensaje);

    // Guardamos historial del bot
    guardarHistorial(phone, respuesta, "bot").catch(() =>
      console.log("⚠️ No se pudo guardar historial del bot.")
    );

    console.log("🤖 RESPUESTA DEL BOT:", respuesta);

    return res.json({ reply: respuesta });

  } catch (err) {
    console.error("❌ ERROR EN /whatsapp:", err);
    return res.json({ reply: "Ocurrió un error procesando tu mensaje." });
  }
});

app.listen(3000, () => {
  console.log("🚀 Servidor iniciado en el puerto 3000");
});
