const rules = require("./rules");
const { comunaValida } = require("./utils");
const { interpretarMensaje, respuestaEmocional } = require("./gpt");
const {
  guardarPedidoTemporal,
  guardarClienteNuevo,
  guardarPedidoCompleto
} = require("./dbSave");

/* ======================================================
   FUNCIONES DE SOPORTE
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
      return "¿Cuál es la dirección exacta?";
    case "solicitar_telefono2":
      return "¿Tienes otro número adicional? Si no, escribe *no*.";
    case "confirmar":
      return "Escribe *sí* para confirmar tu pedido.";
    default:
      return "";
  }
}

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
     PROCESAR PASO DEL FLUJO
  ====================================================== */
  async procesarPaso(state, msg) {
    const info = await interpretarMensaje(msg);

    const reaccion = respuestaEmocional(info.emocion);

    /* ======================================================
       1. Interpretación por intención antes del flujo
    ====================================================== */

    // SALUDO
    if (info.intencion === "saludo") {
      return reaccion + " ¿En qué comuna será el despacho?";
    }

    // AGRADECIMIENTO
    if (info.intencion === "agradecimiento") {
      return reaccion + " ¿Deseas continuar con tu pedido?";
    }

    // PREGUNTA
    if (info.intencion === "pregunta") {
      const respuesta = await interpretarMensaje(info.texto_normalizado);
      return respuesta.texto_normalizado + "\n\n" + obtenerPreguntaDelPaso(state.step);
    }

    // CLIENTE ENTREGA COMUNA
    if (info.intencion === "comuna" && info.comuna) {
      msg = info.comuna;
    }

    // CLIENTE MANIFIESTA PEDIDO
    if (info.intencion === "pedido" && state.step === "tomar_pedido") {
      state.pedido.push(info.pedido);
      await guardarPedidoTemporal(state.phone, state.pedido);
      return "Perfecto 😊 ¿Algo más?";
    }

    /* ======================================================
       2. FLUJO ESTRUCTURADO (los pasos normales)
    ====================================================== */

    switch (state.step) {
      case "solicitar_comuna": {
        const comuna = comunaValida(info.comuna || msg);

        if (!comuna) {
          return "No entendí la comuna 😅 ¿Puedes indicarla nuevamente?";
        }

        state.comuna = comuna;
        state.horarioEntrega = rules.horarios[comuna];
        state.step = "tomar_pedido";
        return `Perfecto 🎉 Entregamos entre ${state.horarioEntrega}. ¿Qué deseas pedir?`;
      }

      case "tomar_pedido":
        if (info.intencion === "pedido") {
          state.pedido.push(info.pedido);
          await guardarPedidoTemporal(state.phone, state.pedido);
          return "¿Algo más?";
        }

        if (msg.toLowerCase().includes("nada")) {
          state.step = "solicitar_nombre";
          return "Perfecto 😊 ¿Cuál es tu nombre y apellido?";
        }

        return "No entendí bien el producto 😅 ¿Qué deseas pedir?";

      case "solicitar_nombre":
        state.datos.nombre = msg;
        state.step = "solicitar_direccion";
        return "¿Cuál es la dirección exacta?";

      case "solicitar_direccion":
        state.datos.direccion = msg;
        state.step = "solicitar_telefono2";
        return "¿Tienes otro número adicional? Si no, escribe *no*.";

      case "solicitar_telefono2":
        state.datos.telefono2 = msg === "no" ? "" : msg;

        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        state.fechaEntrega = manana.toISOString().split("T")[0];

        state.step = "confirmar";

        return `
Resumen del pedido:
${state.pedido.map(p => "- " + p).join("\n")}

Datos:
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Comuna: ${state.comuna}

Entrega: mañana ${state.horarioEntrega}

Confirma escribiendo *sí*.
        `;

      case "confirmar":
        if (msg.toLowerCase() !== "sí" && msg.toLowerCase() !== "si")
          return "Para confirmar escribe *sí* 😊";

        await guardarPedidoCompleto(state);

        state.step = "finalizado";
        return "¡Perfecto! Tu pedido quedó agendado. ✅";

      default:
        return "No entendí, ¿me repites por favor?";
    }
  }
};
