const rules = require("./rules");
const askLuna = require("./gpt");
const { comunaValida } = require("./utils");
const {
  guardarPedidoTemporal,
  guardarClienteNuevo,
  guardarPedidoCompleto
} = require("./dbSave");

/* ======================================================
   DETECTOR DE PREGUNTAS FUERA DEL FLUJO
====================================================== */
const OUT_OF_FLOW_TRIGGER = [
  "cuanto", "precio", "vale", "donde", "horario", 
  "entrega", "entregan", "qué", "que", "cómo", 
  "como", "cuando", "por qué", "porque"
];

function esPreguntaFueraDelFlujo(texto) {
  if (!texto) return false;
  const t = texto.toLowerCase();

  // Pregunta directa
  if (t.includes("?")) return true;

  // Detectar palabras clave al inicio
  return OUT_OF_FLOW_TRIGGER.some(p => t.startsWith(p));
}

/* ======================================================
   FUNCIÓN PARA RETOMAR EL FLUJO DESPUÉS DE RESPONDER
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

/* ======================================================
   ESTADO DEL FLUJO POR CLIENTE
====================================================== */
module.exports = {
  iniciarFlujo(state, phone) {
    return {
      phone,
      step: "bienvenida",
      pedido: [],
      clienteNuevo: false,
      comuna: "",
      fechaEntrega: "",
      horarioEntrega: "",
      datos: {
        nombre: "",
        direccion: "",
        telefono2: ""
      },
      ...state
    };
  },

  /* ======================================================
     PROCESAR FLUJO COMPLETO DEL BOT
  ====================================================== */
  async procesarPaso(state, msg) {
    msg = msg.trim();

    // ===============================================
    // 🧠 1. DETECTOR DE PREGUNTAS FUERA DEL FLUJO
    // ===============================================
    if (esPreguntaFueraDelFlujo(msg)) {
      const respuesta = await askLuna(msg, state);

      // NO avanzamos el flujo, solo respondemos la duda
      const retorno = obtenerPreguntaDelPaso(state.step);

      return respuesta + "\n\n" + retorno;
    }

    // ===============================================
    // 🧠 2. FLUJO NORMAL POR PASOS
    // ===============================================
    switch (state.step) {

      /* =======================
         1. Bienvenida
      ======================= */
      case "bienvenida":
        state.step = "validar_cliente";
        return rules.bienvenida;

      /* =======================
         2. Solicitar comuna
      ======================= */
      case "solicitar_comuna": {
        const comuna = comunaValida(msg);

        if (!comuna) {
          return "No tenemos reparto en esa comuna. ¿Deseas retirar en Calle Chacabuco 1120, Santiago Centro?";
        }

        state.comuna = comuna;
        state.horarioEntrega = rules.horarios[comuna];
        state.step = "tomar_pedido";

        return `Perfecto, entregamos entre ${state.horarioEntrega}. ¿Qué productos deseas pedir?`;
      }

      /* =======================
         3. Tomar pedido
      ======================= */
      case "tomar_pedido": {

        if (msg.toLowerCase().includes("nada más") || msg.toLowerCase().includes("nada mas")) {
          state.step = "solicitar_nombre";
          return "Perfecto. ¿Cuál es tu nombre y apellido?";
        }

        state.pedido.push(msg);

        await guardarPedidoTemporal(state.phone, state.pedido);

        return "¿Algo más? Cuando termines escribe *nada más*.";
      }

      /* =======================
         4. Nombre
      ======================= */
      case "solicitar_nombre":
        state.datos.nombre = msg;
        state.step = "solicitar_direccion";
        return "¿Cuál es la dirección exacta?";

      /* =======================
         5. Dirección
      ======================= */
      case "solicitar_direccion":
        state.datos.direccion = msg;
        state.step = "solicitar_telefono2";
        return "¿Tienes otro número adicional? Si no, escribe *no*.";

      /* =======================
         6. Teléfono adicional
      ======================= */
      case "solicitar_telefono2":
        state.datos.telefono2 = msg.toLowerCase() === "no" ? "" : msg;

        // Fecha de entrega = mañana
        const manana = new Date();
        manana.setDate(manana.getDate() + 1);
        state.fechaEntrega = manana.toISOString().split("T")[0];

        state.step = "confirmar";

        return `
Resumen del pedido:
${state.pedido.map(p => "- " + p).join("\n")}

Datos de despacho:
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Comuna: ${state.comuna}
• Teléfono: ${state.phone}
• Teléfono adicional: ${state.datos.telefono2}

Entrega: mañana entre ${state.horarioEntrega}

Confirma escribiendo *sí*.
        `;

      /* =======================
         7. Confirmación final
      ======================= */
      case "confirmar":
        if (msg.toLowerCase() !== "sí" && msg.toLowerCase() !== "si") {
          return "Para confirmar el pedido escribe *sí*.";
        }

        if (state.clienteNuevo) {
          await guardarClienteNuevo(
            state.phone,
            state.datos.nombre,
            state.datos.direccion,
            state.datos.telefono2,
            state.comuna
          );
        }

        await guardarPedidoCompleto(state);

        state.step = "finalizado";
        return "¡Perfecto! Tu pedido quedó agendado. ✅";

      /* =======================
         8. Conversación cerrada
      ======================= */
      case "finalizado":
        return "Tu pedido ya está confirmado. Si necesitas algo más, aquí estoy 😊";

      /* =======================
         DEFAULT
      ======================= */
      default:
        return "No entendí, ¿me repites por favor?";
    }
  }
};
