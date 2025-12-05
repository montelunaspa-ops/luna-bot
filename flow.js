const rules = require("./rules");
const {
  interpretarMensaje,
  respuestaEmocional,
  responderConocimiento
} = require("./gpt");
const { comunaValida } = require("./utils");
const {
  guardarPedidoTemporal,
  guardarPedidoCompleto
} = require("./dbSave");

/* ======================================================
   PREGUNTAS AUTOMÁTICAS SEGÚN EL PASO
====================================================== */
function obtenerPreguntaDelPaso(step) {
  switch (step) {
    case "solicitar_comuna":
      return "¿En qué comuna será el despacho?";
    case "tomar_pedido":
      return "¿Qué productos deseas pedir? Si ya terminaste escribe *nada más*.";
    case "solicitar_nombre":
      return "¿Cuál es tu nombre y apellido?";
    case "solicitar_direccion":
      return "¿Cuál es la dirección exacta para el despacho?";
    case "solicitar_telefono2":
      return "¿Tienes otro número adicional? Si no, escribe *no*.";
    case "confirmar":
      return "Escribe *sí* para confirmar tu pedido.";
    default:
      return "";
  }
}

/* ======================================================
   INICIAR FLUJO
====================================================== */
module.exports = {
  iniciarFlujo(state, phone) {
    return {
      phone,
      step: "bienvenida",
      clienteNuevo: false,
      comuna: "",
      pedido: [],
      datos: { nombre: "", direccion: "", telefono2: "" },
      horarioEntrega: "",
      fechaEntrega: "",
      ...state
    };
  },

  /* ======================================================
     PROCESAR CADA PASO
  ====================================================== */
  async procesarPaso(state, msg) {
    // Interpretación por inteligencia GPT
    const info = await interpretarMensaje(msg);
    const emocion = respuestaEmocional(info.emocion);

    /* ======================================================
       RESPUESTAS POR INTENCIÓN (antes del flujo)
    ====================================================== */

    // SALUDOS
    if (info.intencion === "saludo") {
      return (
        emocion +
        " " +
        obtenerPreguntaDelPaso(state.step)
      );
    }

    // AGRADECIMIENTO
    if (info.intencion === "agradecimiento") {
      return emocion + " ¿Deseas continuar con tu pedido?";
    }

    // PREGUNTA
    // ⚡ NUEVA LÓGICA DE PREGUNTAS BASADA EN CONOCIMIENTO
if (info.intencion === "pregunta") {
  const respuestaBot = await responderConocimiento(info.texto_normalizado);

  return (
    emocion +
    " " +
    respuestaBot +
    "\n\n" +
    obtenerPreguntaDelPaso(state.step)
  );
}


    // PEDIDO (si está en el paso correspondiente)
    if (info.intencion === "pedido" && state.step === "tomar_pedido") {
      state.pedido.push(info.pedido);
      await guardarPedidoTemporal(state.phone, state.pedido);
      return emocion + " Perfecto 😊 ¿Algo más?";
    }

    /* ======================================================
       🔥 PASO 1 — SOLICITAR COMUNA (CON GPT + utils.js)
    ====================================================== */
    if (state.step === "solicitar_comuna") {
      let comunaDetectada = null;

      // Primer intento: GPT interpretó una comuna
      if (info.comuna) {
        comunaDetectada = comunaValida(info.comuna);
      }

      // Segundo intento: utils.js corrige lo escrito
      if (!comunaDetectada) {
        comunaDetectada = comunaValida(msg);
      }

      // Ninguna coincidencia válida
      if (!comunaDetectada) {
        return (
          emocion +
          " No logré identificar la comuna 😅\n" +
          "Por favor indícame nuevamente la comuna."
        );
      }

      // Comuna válida
      state.comuna = comunaDetectada;
      state.horarioEntrega = rules.horarios[comunaDetectada];
      state.step = "tomar_pedido";

      return (
        emocion +
        ` Perfecto 🎉 Entregamos entre *${state.horarioEntrega}*.\n¿Qué deseas pedir?`
      );
    }

    /* ======================================================
       🔥 PASO 2 — TOMAR PEDIDO
    ====================================================== */
    if (state.step === "tomar_pedido") {
      // Cliente terminó de pedir
      if (msg.toLowerCase().includes("nada")) {
        state.step = "solicitar_nombre";
        return emocion + " Perfecto 😊 ¿Cuál es tu nombre y apellido?";
      }

      // GPT detectó pedido
      if (info.intencion === "pedido") {
        state.pedido.push(info.pedido);
        await guardarPedidoTemporal(state.phone, state.pedido);
        return emocion + " Anotado 😊 ¿Algo más?";
      }

      return emocion + " No entendí bien el producto 😅 ¿Qué deseas pedir?";
    }

    /* ======================================================
       🔥 PASO 3 — SOLICITAR NOMBRE
    ====================================================== */
    if (state.step === "solicitar_nombre") {
      state.datos.nombre = msg;
      state.step = "solicitar_direccion";
      return emocion + " ¿Cuál es la dirección exacta?";
    }

    /* ======================================================
       🔥 PASO 4 — SOLICITAR DIRECCIÓN
    ====================================================== */
    if (state.step === "solicitar_direccion") {
      state.datos.direccion = msg;
      state.step = "solicitar_telefono2";
      return emocion + " ¿Tienes otro número adicional? Si no, escribe *no*.";
    }

    /* ======================================================
       🔥 PASO 5 — SOLICITAR TELÉFONO 2
    ====================================================== */
    if (state.step === "solicitar_telefono2") {
      state.datos.telefono2 = msg.toLowerCase() === "no" ? "" : msg;

      const manana = new Date();
      manana.setDate(manana.getDate() + 1);
      state.fechaEntrega = manana.toISOString().split("T")[0];

      state.step = "confirmar";

      return `
Resumen del pedido 📦
${state.pedido.map(p => "- " + p).join("\n")}

Datos del despacho 🏡
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Comuna: ${state.comuna}

🗓️ *Entrega:* mañana entre ${state.horarioEntrega}

Para confirmar escribe: *sí*
`;
    }

    /* ======================================================
       🔥 PASO 6 — CONFIRMAR PEDIDO
    ====================================================== */
    if (state.step === "confirmar") {
      if (msg.toLowerCase() !== "sí" && msg.toLowerCase() !== "si") {
        return emocion + " Para confirmar escribe *sí* 😊";
      }

      await guardarPedidoCompleto(state);

      state.step = "finalizado";

      return (
        emocion +
        " ¡Perfecto! Tu pedido quedó agendado. ✅"
      );
    }

    /* ======================================================
       🔥 RESPUESTA POR DEFECTO
    ====================================================== */
    return (
      emocion +
      " No entendí bien 😅 ¿Me lo repites por favor?"
    );
  }
};
