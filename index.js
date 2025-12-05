require("dotenv").config();
const express = require("express");
const askLuna = require("./gpt");
const supabase = require("./supabase");
const flow = require("./flow");
const { clienteExiste } = require("./utils");

const app = express();
app.use(express.json());

// Estado temporal por cliente
let sessions = {};

app.post("/whatsapp", async (req, res) => {
  console.log("[DEBUG WHATAUTO]:", req.body);

  const { phone, message } = req.body;

  if (!phone || !message) {
    return res.json({ reply: "No recibí mensaje válido." });
  }

  // Crear sesión si no existe
  if (!sessions[phone]) sessions[phone] = flow.iniciarFlujo({}, phone);
  const state = sessions[phone];

  // Si está en paso validación, revisar bd
  if (state.step === "validar_cliente") {
    const existe = await clienteExiste(phone, supabase);

    if (!existe) {
      state.step = "solicitar_comuna";
      return res.json({
        reply:
          "Aquí tienes nuestro catálogo:\n\n" +
          require("./rules").catalogo +
          "\n¿En qué comuna será el despacho?"
      });
    } else {
      // Cliente antiguo → saltar comuna y datos
      state.step = "tomar_pedido";
      return res.json({
        reply: "Bienvenido nuevamente 😊 ¿Qué deseas pedir hoy?"
      });
    }
  }

  // Procesar flujo normal
  const response = flow.procesarPaso(state, message);

  res.json({ reply: response });
});

// Iniciar servidor
app.listen(3000, () =>
  console.log("Luna Bot funcionando en puerto 3000 ✨")
);
