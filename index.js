const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const { iniciarFlujo, procesarPaso } = require("./flow");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const sesiones = {};

/* ===========================================================
   🟢 WEBHOOK
   =========================================================== */
app.post("/whatsapp", async (req, res) => {
  try {
    const body = req.body;

    const phone = body.phone;
    const mensaje = body.message;

    if (!sesiones[phone]) {
      sesiones[phone] = iniciarFlujo({}, phone);
    }

    const respuesta = await procesarPaso(sesiones[phone], mensaje);

    res.json({
      reply: respuesta
    });

  } catch (e) {
    console.error("❌ ERROR EN /whatsapp:", e);
    res.json({ reply: "Hubo un error procesando tu mensaje." });
  }
});

app.listen(3000, () => console.log("🚀 Servidor iniciado en el puerto 3000"));
