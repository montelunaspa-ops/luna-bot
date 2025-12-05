require("dotenv").config();
const express = require("express");
const askLuna = require("./gpt");
const supabase = require("./supabase");
const flow = require("./flow");
const { clienteExiste } = require("./utils");
const { guardarHistorial } = require("./dbSave");

const app = express();

// Muy importante: soportar JSON y payloads enviados como texto
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Ruta GET opcional
app.get("/", (req, res) => {
  res.send("✨ Luna Bot está activo ✨");
});

// Sesiones por número
let sessions = {};

app.post("/whatsapp", async (req, res) => {
  console.log("🟣 RAW BODY:", req.body);

  // Protección: si req.body viene vacío
  if (!req.body) {
    console.log("❌ ERROR: WhatsAuto no envió cuerpo JSON.");
    return res.json({ reply: "No recibí datos válidos." });
  }

  // Extraemos datos reales de WhatsAuto
  const phone = req.body.phone || null;
  const message = req.body.message || req.body.text || null;

  if (!phone || !message) {
    console.log("❌ ERROR: Formato inválido:", req.body);
    return res.json({ reply: "No recibí un mensaje válido." });
  }

  console.log("📩 MENSAJE RECIBIDO:", { phone, message });

  // Guardar historial entrada
  guardarHistorial(phone, message, "cliente");

  // Crear sesión si no existe
  if (!sessions[phone]) sessions[phone] = flow.iniciarFlujo({}, phone);

  const state = sessions[phone];

  // 1️⃣ Validación cliente
  if (state.step === "validar_cliente") {
    const existe = await clienteExiste(phone, supabase);

    if (!existe) {
      state.clienteNuevo = true;
      state.step = "solicitar_comuna";

      const reply =
        "Aquí tienes nuestro catálogo:\n\n" +
        require("./rules").catalogo +
        "\n¿En qué comuna será el despacho?";

      guardarHistorial(phone, reply, "bot");
      return res.json({ reply });
    }

    // Cliente existente
    state.clienteNuevo = false;
    state.step = "tomar_pedido";

    const reply = "Bienvenido nuevamente 😊 ¿Qué deseas pedir hoy?";
    guardarHistorial(phone, reply, "bot");
    return res.json({ reply });
  }

  // 2️⃣ Flujo normal
  const response = await flow.procesarPaso(state, message);

  guardarHistorial(phone, response, "bot");

  return res.json({ reply: response });
});

// Iniciar servidor
app.listen(process.env.PORT || 3000, () =>
  console.log("✨ Luna Bot funcionando en Render ✨")
);
