require("dotenv").config();
const express = require("express");
const askLuna = require("./gpt");
const supabase = require("./supabase");
const flow = require("./flow");
const { clienteExiste } = require("./utils");
const { guardarHistorial } = require("./dbSave");

const app = express();
app.use(express.json());

// Estado temporal por cliente
let sessions = {};

/* ======================================================
   🟣 WEBHOOK DE WHATAUTO
====================================================== */
app.post("/whatsapp", async (req, res) => {
  console.log("[DEBUG WHATAUTO]:", req.body);

  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.json({ reply: "No recibí un mensaje válido." });
  }

  // Guardar historial del cliente
  guardarHistorial(phone, message, "cliente");

  // Crear sesión si no existe
  if (!sessions[phone]) sessions[phone] = flow.iniciarFlujo({}, phone);

  const state = sessions[phone];

  /* ======================================================
      1. VALIDAR CLIENTE EN SUPABASE
  ====================================================== */
  if (state.step === "validar_cliente") {
    const existe = await clienteExiste(phone, supabase);

    // Cliente nuevo
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

  /* ======================================================
      2. FLUJO NORMAL
  ====================================================== */
  const response = await flow.procesarPaso(state, message);

  guardarHistorial(phone, response, "bot");

  res.json({ reply: response });
});

/* ======================================================
   🟣 INICIAR SERVIDOR
====================================================== */
app.listen(3000, () =>
  console.log("✨ Luna Bot funcionando en puerto 3000 ✨")
);
