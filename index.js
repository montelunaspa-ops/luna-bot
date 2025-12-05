// ===============================
// 📌 LUNA BOT - INDEX.JS FINAL
// ===============================

require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const app = express();

const flow = require("./flow");
const { guardarHistorial } = require("./utils-db");

// ===============================
// ⚙️ CONFIGURACIÓN DE EXPRESS
// ===============================

// WhatsAuto envía los datos como: app=XX&sender=XX&phone=XX...
app.use(bodyParser.text({ type: "*/*" })); 

// ===============================
// 🧠 DECODIFICAR EL BODY DE WHATSAUTO
// ===============================
function decodeWhatsAutoBody(rawBody) {
  if (!rawBody || typeof rawBody !== "string") return null;

  try {
    const params = new URLSearchParams(rawBody);
    return {
      app: params.get("app"),
      sender: params.get("sender"),
      phone: params.get("phone"),
      message: params.get("message"),
      type: params.get("type") || "text"
    };
  } catch (err) {
    console.log("❌ Error parseando WhatsAuto:", rawBody);
    return null;
  }
}

// ===============================
// 📌 ENDPOINT PRINCIPAL
// ===============================
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("🟣 BODY CRUDO RECIBIDO:", req.body);

    const data = decodeWhatsAutoBody(req.body);

    if (!data || !data.phone || !data.message) {
      console.log("❌ ERROR: Body inválido o vacío");
      return res.json({ reply: "Error en el mensaje recibido" });
    }

    console.log("🟣 BODY DECODIFICADO:", data);

    const phone = data.phone.trim();
    const message = data.message.trim();

    console.log("📩 MENSAJE RECIBIDO:", { phone, message });

    // ===============================
    // 🗄️ GUARDAR HISTORIAL
    // ===============================
    await guardarHistorial(phone, message, "cliente");

    // ===============================
    // 🤖 PROCESAR MENSAJE EN EL FLUJO
    // ===============================
    const respuesta = await flow.procesarMensaje(phone, message);

    // ===============================
    // 🧾 GUARDAR RESPUESTA DEL BOT
    // ===============================
    await guardarHistorial(phone, respuesta, "bot");

    console.log("🤖 RESPUESTA DEL BOT:", respuesta);

    return res.json({ reply: respuesta });

  } catch (err) {
    console.error("❌ ERROR EN /whatsapp:", err);
    return res.json({ reply: "Ocurrió un error procesando tu mensaje 😔" });
  }
});

// ===============================
// 🟢 SERVIDOR
// ===============================
app.get("/", (req, res) => {
  res.send("Luna Bot está funcionando correctamente ✔️");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
});
