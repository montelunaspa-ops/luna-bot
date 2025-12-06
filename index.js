require("dotenv").config();
const express = require("express");
const app = express();

const { iniciarFlujo, procesarPaso } = require("./flow");
const { guardarHistorial } = require("./dbSave");

/* ===========================================================
   🟢 CONFIGURAR PARSERS
   =========================================================== */
app.use(express.urlencoded({ extended: true }));
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf.toString(); }
}));

/* ===========================================================
   🟢 Sesiones en memoria
   =========================================================== */
const sesiones = {};

/* ===========================================================
   🟢 Decodificar cuerpo URL-Encoded (WhatsAuto)
   =========================================================== */
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

/* ===========================================================
   🟢 ENDPOINT PRINCIPAL
   =========================================================== */
app.post("/whatsapp", async (req, res) => {
  let body = req.body;

  if (!body || Object.keys(body).length === 0) {
    if (req.rawBody) body = decodificarBody(req.rawBody);
  }

  if (!body) {
    console.log("❌ No se pudo leer el body");
    return res.json({ reply: "Error procesando mensaje" });
  }

  const phone = String(body.phone || "").replace(/\s/g, "");
  const message = body.message || "";

  console.log("📩 BODY RECIBIDO:", body);
  console.log("📩 MENSAJE:", { phone, message });

  if (!phone) return res.json({ reply: "Error: no llegó número." });

  await guardarHistorial(phone, message, "cliente");

  if (!sesiones[phone]) sesiones[phone] = iniciarFlujo({}, phone);

  const respuesta = await procesarPaso(sesiones[phone], message);

  await guardarHistorial(phone, respuesta, "bot");

  res.json({ reply: respuesta });
});

/* ===========================================================
   🟢 INICIAR SERVIDOR
   =========================================================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor iniciado en el puerto ${PORT}`));
