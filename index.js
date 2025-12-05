require("dotenv").config();
const express = require("express");
const askLuna = require("./gpt");
const supabase = require("./supabase");
const flow = require("./flow");
const { clienteExiste } = require("./utils");
const { guardarHistorial } = require("./dbSave");

const app = express();

// ======================================================
// 🟣 CONFIGURACIÓN CORRECTA PARA WHATSAUTO
// WhatsAuto envía los datos como application/x-www-form-urlencoded
// ======================================================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ruta GET para pruebas
app.get("/", (req, res) => {
  res.send("✨ Luna Bot está activo y funcionando ✨");
});

// Estado por cliente
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

  // Guardar historial de entrada
  guardarHistorial(phone, message, "cliente");

  // Crear sesión si no existe
  if (!sessions[phone]) {
    sessions[phone] = flow.iniciarFlujo({}, phone);
  }

  const state = sessions[phone];


  // ======================================================
  // 🟣 1. VALIDAR CLIENTE NUEVO O EXISTENTE
  // ======================================================
  if (state.step === "validar_cliente") {
    const existe = await clienteExiste(phone, supabase);

    if (!existe) {
      state.clienteNuevo = true;
      state.step = "solicitar_comuna";

      const reply =
        "Aquí tienes nuestro catálogo:\n\n" +
        require("./rules").catalogo +
        "\n¿En qué comuna será el despacho?";

      console.log("🤖 RESPUESTA DEL BOT:", reply);
      guardarHistorial(phone, reply, "bot");
      return res.json({ reply });
    }

    // Cliente existente
    state.clienteNuevo = false;
    state.step = "tomar_pedido";

    const reply = "Bienvenido nuevamente 😊 ¿Qué deseas pedir hoy?";

    console.log("🤖 RESPUESTA DEL BOT:", reply);
    guardarHistorial(phone, reply, "bot");
    return res.json({ reply });
  }


  // ======================================================
  // 🟣 2. PROCESAR FLUJO NORMAL DEL BOT
  // ======================================================
  const response = await flow.procesarPaso(state, message);

  // LOG NUEVO ▶️ Ahora verás la respuesta del bot en Render
  console.log("🤖 RESPUESTA DEL BOT:", response);

  // Guardar historial salida
  guardarHistorial(phone, response, "bot");

  return res.json({ reply: response });
});


// ======================================================
// 🟣 INICIAR SERVIDOR
// ======================================================
app.listen(process.env.PORT || 3000, () =>
  console.log("✨ Luna Bot funcionando correctamente en Render ✨")
);
