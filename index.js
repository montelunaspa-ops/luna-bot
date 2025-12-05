require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const qs = require("qs");

const rules = require("./rules");
const { guardarHistorial } = require("./dbSave");
const { clienteExiste } = require("./utils-db");
const flow = require("./flow");

const app = express();

// WhatsAuto envía el body como text/plain con formato x-www-form-urlencoded
app.use(bodyParser.text({ type: "*/*" }));

// Sesiones por número de teléfono
const sesiones = {};

/* Decodificar el body que envía WhatsAuto */
function parseWhatsAutoBody(rawBody) {
  try {
    const parsed = qs.parse(rawBody);
    return {
      app: parsed.app || null,
      sender: parsed.sender || null,
      phone: parsed.phone || null,
      message: parsed.message || null,
      type: parsed.type || "text"
    };
  } catch (err) {
    console.error("❌ Error parseando body de WhatsAuto:", err);
    return null;
  }
}

app.post("/whatsapp", async (req, res) => {
  try {
    console.log("🟣 BODY CRUDO RECIBIDO:", req.body);
    const data = parseWhatsAutoBody(req.body);

    if (!data || !data.phone || !data.message) {
      console.log("❌ ERROR: body inválido o sin phone/message");
      return res.json({ reply: "No recibí un mensaje válido." });
    }

    const phone = data.phone.trim();
    const message = data.message.trim();

    console.log("🟣 BODY DECODIFICADO:", data);
    console.log("📩 MENSAJE RECIBIDO:", { phone, message });

    // Guardar mensaje del cliente
    await guardarHistorial(phone, message, "cliente");

    // Crear sesión si no existe
    if (!sesiones[phone]) {
      console.log("🆕 Nueva sesión creada:", phone);

      const existe = await clienteExiste(phone);
      let state = flow.iniciarFlujo({}, phone);
      sesiones[phone] = state;

      let reply;

      if (!existe) {
        state.clienteNuevo = true;
        state.step = "solicitar_comuna";

        reply =
          `${rules.bienvenida}\n\n` +
          rules.catalogo +
          "\n" +
          rules.comunasTexto +
          "\n¿En qué comuna será el despacho?";
      } else {
        state.clienteNuevo = false;
        state.step = "tomar_pedido";

        reply =
          `${rules.bienvenida}\n\n` +
          "Bienvenido nuevamente 😊 ¿Qué deseas pedir hoy?";
      }

      await guardarHistorial(phone, reply, "bot");
      console.log("🤖 RESPUESTA DEL BOT:", reply);

      return res.json({ reply });
    }

    // Si ya existe sesión → continuar flujo
    const state = sesiones[phone];

    // Opción de reiniciar flujo si escribe "hola"
    if (message.toLowerCase().trim() === "hola") {
      console.log("🔄 Reinicio de flujo solicitado");

      const existe = await clienteExiste(phone);
      let stateNuevo = flow.iniciarFlujo({}, phone);
      sesiones[phone] = stateNuevo;

      let reply;

      if (!existe) {
        stateNuevo.clienteNuevo = true;
        stateNuevo.step = "solicitar_comuna";

        reply =
          `${rules.bienvenida}\n\n` +
          rules.catalogo +
          "\n" +
          rules.comunasTexto +
          "\n¿En qué comuna será el despacho?";
      } else {
        stateNuevo.clienteNuevo = false;
        stateNuevo.step = "tomar_pedido";

        reply =
          `${rules.bienvenida}\n\n` +
          "Bienvenido nuevamente 😊 ¿Qué deseas pedir hoy?";
      }

      await guardarHistorial(phone, reply, "bot");
      console.log("🤖 RESPUESTA DEL BOT:", reply);

      return res.json({ reply });
    }

    // Procesar paso normal
    const respuesta = await flow.procesarPaso(state, message);

    await guardarHistorial(phone, respuesta, "bot");
    console.log("🤖 RESPUESTA DEL BOT:", respuesta);

    return res.json({ reply: respuesta });
  } catch (err) {
    console.error("❌ ERROR EN /whatsapp:", err);
    return res.json({
      reply:
        "Hubo un problema temporal al procesar tu mensaje 😔. Intenta nuevamente en unos segundos."
    });
  }
});

app.get("/", (req, res) => {
  res.send("✨ Luna Bot activo y funcionando correctamente ✨");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en el puerto ${PORT}`);
});
