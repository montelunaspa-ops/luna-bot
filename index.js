require("dotenv").config();
const express = require("express");
const rules = require("./rules");
const flow = require("./flow");
const supabase = require("./supabase");
const { clienteExiste } = require("./utils-db");
const { guardarHistorial } = require("./dbSave");

const app = express();

// WhatsAuto envía application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Sesiones activas por número
let sessions = {};

/* ======================================================
   RUTA DE SALUD DEL BOT
====================================================== */
app.get("/", (req, res) => {
  res.send("✨ Luna Bot activo y funcionando correctamente ✨");
});

/* ======================================================
   ENDPOINT PRINCIPAL PARA WHATSAPP
====================================================== */
app.post("/whatsapp", async (req, res) => {
  try {
    console.log("🟣 BODY DECODIFICADO:", req.body);

    const phone = req.body.phone;
    let message = req.body.message;

    // Validación mínima
    if (!phone || !message) {
      console.log("❌ ERROR: request inválido.");
      return res.json({ reply: "No recibí un mensaje válido." });
    }

    console.log("📩 MENSAJE RECIBIDO:", { phone, message });

    // Reemplazo de mensajes de voz por texto normalizado
    if (message.includes("🎤")) {
      message = "mensaje de voz";
    }

    // Guardar historial cliente ↩
    guardarHistorial(phone, message, "cliente");

    /* ======================================================
       SI NO EXISTE SESIÓN, SE CREA Y SE EJECUTA BIENVENIDA + VALIDACIÓN
    ====================================================== */
    if (!sessions[phone]) {
      console.log("🆕 Nueva sesión creada:", phone);

      sessions[phone] = flow.iniciarFlujo({}, phone);

      const estado = sessions[phone];

      // 1) Enviar bienvenida
      const saludo = rules.bienvenida;
      guardarHistorial(phone, saludo, "bot");

      // 2) Validación inmediata del cliente
      const existe = await clienteExiste(phone, supabase);

      if (!existe) {
        estado.clienteNuevo = true;
        estado.step = "solicitar_comuna";

        const reply =
          saludo +
          "\n\nAquí tienes nuestro catálogo:\n\n" +
          rules.catalogo +
          "\n" +
          "\n¿En qué comuna será el despacho?";

        console.log("🤖 RESPUESTA DEL BOT:", reply);
        guardarHistorial(phone, reply, "bot");

        return res.json({ reply });
      }

      // Cliente existente
      estado.clienteNuevo = false;
      estado.step = "tomar_pedido";

      const reply =
        saludo + "\n\nBienvenido nuevamente 😊 ¿Qué deseas pedir hoy?";

      console.log("🤖 RESPUESTA DEL BOT:", reply);
      guardarHistorial(phone, reply, "bot");

      return res.json({ reply });
    }

    /* ======================================================
       SI YA HAY SESIÓN, CONTINUAR EL FLUJO
    ====================================================== */
    const state = sessions[phone];

    // Reinicio manual del flujo al decir "hola"
    if (message.toLowerCase().trim() === "hola") {
      console.log("🔄 Reiniciando flujo por saludo");

      sessions[phone] = flow.iniciarFlujo({}, phone);
      const estado = sessions[phone];

      const saludo = rules.bienvenida;
      guardarHistorial(phone, saludo, "bot");

      const existe = await clienteExiste(phone, supabase);

      if (!existe) {
        estado.clienteNuevo = true;
        estado.step = "solicitar_comuna";

        const reply =
          saludo +
          "\n\nAquí tienes nuestro catálogo:\n\n" +
          rules.catalogo +
          "\n" +
          rules.comunas +
          "\n¿En qué comuna será el despacho?";

        guardarHistorial(phone, reply, "bot");

        return res.json({ reply });
      }

      estado.clienteNuevo = false;
      estado.step = "tomar_pedido";

      const reply = saludo + "\n\n¿Qué deseas pedir hoy?";
      guardarHistorial(phone, reply, "bot");

      return res.json({ reply });
    }

    /* ======================================================
       PROCESAR PASO (INTELIGENCIA EMOCIONAL + GPT + UTILS)
    ====================================================== */
    const respuesta = await flow.procesarPaso(state, message);

    console.log("🤖 RESPUESTA DEL BOT:", respuesta);

    guardarHistorial(phone, respuesta, "bot");

    return res.json({ reply: respuesta });
  } catch (error) {
    console.error("❌ ERROR EN /whatsapp:", error);

    return res.json({
      reply:
        "Hubo un inconveniente temporal 😔 Puedes intentar nuevamente en unos segundos."
    });
  }
});

/* ======================================================
   SERVIDOR LEVANTADO
====================================================== */
app.listen(process.env.PORT || 3000, () =>
  console.log("✨ Luna Bot funcionando correctamente en Render ✨")
);
