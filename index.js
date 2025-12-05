require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const qs = require("qs");

const { guardarHistorial } = require("./dbSave");
const flow = require("./flow");
const { clienteExiste } = require("./utils-db");

const app = express();
app.use(bodyParser.text({ type: "*/*" }));

// Sesiones en memoria (puedes moverlas luego a Supabase si quieres persistencia)
const sesiones = {};

/* ======================================================
   🟣 DECODIFICAR BODY QUE WHATAUTO ENVÍA COMO TEXT/FORM
====================================================== */
function parseWhatsAutoBody(rawBody) {
  try {
    const body = qs.parse(rawBody);
    return {
      app: body.app || null,
      sender: body.sender || null,
      phone: body.phone || null,
      message: body.message || null,
      type: body.type || "text"
    };
  } catch (err) {
    console.error("❌ Error intentando parsear el body:", err);
    return null;
  }
}

/* ======================================================
   🟣 WEBHOOK PRINCIPAL DEL BOT
====================================================== */
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("🟣 BODY CRUDO RECIBIDO:", req.body);

    const data = parseWhatsAutoBody(req.body);

    if (!data || !data.phone || !data.message) {
      console.log("❌ ERROR: Body inválido o sin datos necesarios");
      return res.json({ reply: "Hubo un error recibiendo tu mensaje." });
    }

    console.log("🟣 BODY DECODIFICADO:", data);

    const phone = data.phone.trim();
    const message = data.message.trim();

    console.log("📩 MENSAJE RECIBIDO:", { phone, message });

    // Crear sesión si no existe
    if (!sesiones[phone]) {
      sesiones[phone] = {
        phone,
        step: "comuna",       // Primer paso del flujo
        comuna: null,
        pedido: [],
        datos: {},
        fechaEntrega: null,
        horarioEntrega: null
      };
      console.log("🆕 Nueva sesión creada:", phone);
    }

    const state = sesiones[phone];

    // Guardar mensaje del cliente en historial
    await guardarHistorial(phone, message, "cliente");

    /* ======================================================
       ⚡ PROCESAR FLUJO DEL BOT
    ======================================================= */
    const respuesta = await flow.procesarPaso(state, message);

    // Guardamos respuesta en historial
    await guardarHistorial(phone, respuesta, "bot");

    console.log("🤖 RESPUESTA DEL BOT:", respuesta);

    // Respuesta final a WhatsAuto
    return res.json({ reply: respuesta });

  } catch (err) {
    console.error("❌ ERROR EN /whatsapp:", err);
    return res.json({
      reply: "Ocurrió un error procesando tu mensaje 😔 intenta nuevamente."
    });
  }
});

/* ======================================================
   🟢 ENDPOINT DE PRUEBA
====================================================== */
app.get("/", (req, res) => {
  res.send("Luna Bot activo 💫");
});

/* ======================================================
   🚀 INICIAR SERVIDOR
====================================================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
});
