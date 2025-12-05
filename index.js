require("dotenv").config();
const express = require("express");
const askLuna = require("./gpt");
const supabase = require("./supabase");
const flow = require("./flow");
const { clienteExiste } = require("./utils");
const { guardarHistorial } = require("./dbSave");

const app = express();

// =======================================
// 🟣 CONFIGURACIÓN PARA RECIBIR TEXTO PLANO
// =======================================
app.use(express.text({ type: "*/*" })); // WhatsAuto envía text/plain
app.use(express.json({ strict: false }));
app.use(express.urlencoded({ extended: true }));

// Ruta GET para pruebas
app.get("/", (req, res) => {
  res.send("✨ Luna Bot está activo y funcionando ✨");
});

// Estado de sesión por número
let sessions = {};


// =======================================
// 🟣 ENDPOINT PRINCIPAL DEL BOT
// =======================================
app.post("/whatsapp", async (req, res) => {

  console.log("🟣 BODY CRUDO RECIBIDO:", req.body);

  let payload;

  // ---------------------------------------
  // 🧠 Caso 1: WhatsAuto envía texto plano
  // ---------------------------------------
  if (typeof req.body === "string") {
    try {
      payload = JSON.parse(req.body);
    } catch (e) {
      console.log("❌ ERROR: No se pudo parsear el texto plano:", req.body);
      return res.json({ reply: "No recibí un mensaje válido." });
    }
  } 
  
  // ---------------------------------------
  // 🧠 Caso 2: WhatsAuto envía JSON normal
  // ---------------------------------------
  else {
    payload = req.body;
  }

  console.log("🟢 PAYLOAD FINAL:", payload);

  // Extraer datos del JSON real
  const phone = payload.phone;
  const message = payload.message;

  if (!phone || !message) {
    console.log("❌ ERROR: WhatsAuto no envió phone o message.");
    return res.json({ reply: "No recibí un mensaje válido." });
  }

  console.log("📩 MENSAJE RECIBIDO:", { phone, message });

  // Guardar historial del cliente
  guardarHistorial(phone, message, "cliente");

  // Crear sesión si no existe
  if (!sessions[phone]) sessions[phone] = flow.iniciarFlujo({}, phone);
  const state = sessions[phone];


  // =======================================
  // 🟣 1. VALIDAR CLIENTE NUEVO O EXISTENTE
  // =======================================
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


  // =======================================
  // 🟣 2. FLUJO NORMAL DEL BOT
  // =======================================
  const response = await flow.procesarPaso(state, message);

  guardarHistorial(phone, response, "bot");

  return res.json({ reply: response });
});


// =======================================
// 🟣 INICIAR SERVIDOR
// =======================================
app.listen(process.env.PORT || 3000, () =>
  console.log("✨ Luna Bot funcionando correctamente en Render ✨")
);
