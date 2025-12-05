require("dotenv").config();
const express = require("express");
const askLuna = require("./gpt");
const supabase = require("./supabase");
const flow = require("./flow");
const rules = require("./rules");
const { clienteExiste } = require("./utils");
const { guardarHistorial } = require("./dbSave");

const app = express();

// WhatsAuto envía los datos como application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ruta de prueba
app.get("/", (req, res) => {
  res.send("✨ Luna Bot activo y funcionando correctamente ✨");
});

// Sesión por número
let sessions = {};

// ======================================================
// 🟣 ENDPOINT PRINCIPAL DEL BOT
// ======================================================
app.post("/whatsapp", async (req, res) => {
  console.log("🟣 BODY DECODIFICADO:", req.body);

  const phone = req.body.phone;
  const message = req.body.message;

  if (!phone || !message) {
    console.log("❌ ERROR: WhatsAuto no envió phone o message.");
    return res.json({ reply: "No recibí un mensaje válido." });
  }

  console.log("📩 MENSAJE RECIBIDO:", { phone, message });

  // Guardar historial entrada
  guardarHistorial(phone, message, "cliente");

  // Crear sesión si no existe
  if (!sessions[phone]) {
    sessions[phone] = flow.iniciarFlujo({}, phone);
  }

  let state = sessions[phone];

  // ======================================================
  // ⭐ 1. SALUDO + VALIDACIÓN INMEDIATA EN EL MISMO MENSAJE
  // ======================================================
  if (state.step === "bienvenida") {
    // ------------------------------
    // Enviar saludo inicial
    // ------------------------------
    const saludo = rules.bienvenida;
    console.log("🤖 RESPUESTA DEL BOT:", saludo);
    guardarHistorial(phone, saludo, "bot");

    // Avanzamos al paso siguiente sin esperar otro mensaje
    state.step = "validar_cliente";

    // ------------------------------
    // Validar cliente en Supabase
    // ------------------------------
    const existe = await clienteExiste(phone, supabase);

    // 🔵 CLIENTE NUEVO → Enviar catálogo inmediatamente
    if (!existe) {
      state.clienteNuevo = true;
      state.step = "solicitar_comuna";

      const reply =
        "Aquí tienes nuestro catálogo:\n\n" +
        rules.catalogo +
        "\n¿En qué comuna será el despacho?";

      console.log("🤖 RESPUESTA DEL BOT:", reply);
      guardarHistorial(phone, reply, "bot");
      return res.json({ reply });
    }

    // 🟢 CLIENTE EXISTENTE → Ir directo a toma de pedido
    state.clienteNuevo = false;
    state.step = "tomar_pedido";

    const reply = "Bienvenido nuevamente 😊 ¿Qué deseas pedir hoy?";
    console.log("🤖 RESPUESTA DEL BOT:", reply);
    guardarHistorial(phone, reply, "bot");
    return res.json({ reply });
  }

  // ======================================================
  // ⭐ 2. FLUJO NORMAL PARA MENSAJES SUBSIGUIENTES
  // ======================================================
  const response = await flow.procesarPaso(state, message);

  console.log("🤖 RESPUESTA DEL BOT:", response);

  guardarHistorial(phone, response, "bot");

  return res.json({ reply: response });
});

// ======================================================
// 🟣 SERVIDOR
// ======================================================
app.listen(process.env.PORT || 3000, () =>
  console.log("✨ Luna Bot funcionando correctamente en Render ✨")
);
