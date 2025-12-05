const rules = require("./rules");
const { comunaValida } = require("./utils");

module.exports = {
  iniciarFlujo(state, phone) {
    return {
      phone,
      step: "bienvenida",
      pedido: [],
      datos: {
        nombre: "",
        direccion: "",
        telefono2: ""
      },
      comuna: "",
      ...state
    };
  },

  procesarPaso(state, msg) {
    switch (state.step) {

      case "bienvenida":
        state.step = "validar_cliente";
        return rules.bienvenida;

      case "solicitar_comuna":
        const comuna = comunaValida(msg);
        if (!comuna) {
          return "No tenemos reparto en esa comuna. ¿Deseas retirar en Calle Chacabuco 1120, Santiago Centro?";
        }
        state.comuna = comuna;
        state.step = "tomar_pedido";
        return `Perfecto, entregamos entre ${rules.horarios[comuna]}. ¿Qué productos deseas?`;

      case "tomar_pedido":
        if (msg.toLowerCase().includes("nada más")) {
          state.step = "solicitar_nombre";
          return "Perfecto. Ahora, ¿cuál es tu nombre y apellido?";
        }
        state.pedido.push(msg);
        return "¿Algo más? Cuando termines escribe *nada más*.";

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
        state.step = "confirmar";
        return `
Resumen del pedido:
${state.pedido.join("\n")}

Datos de despacho:
Nombre: ${state.datos.nombre}
Dirección: ${state.datos.direccion}
Comuna: ${state.comuna}
Teléfono: ${state.phone}
Teléfono adicional: ${state.datos.telefono2}

Entrega: mañana aproximadamente entre ${rules.horarios[state.comuna]}

Confirma escribiendo *sí*.
        `;

      case "confirmar":
        state.step = "finalizado";
        return "¡Perfecto! Tu pedido quedó agendado. ✅";

      default:
        return "No entendí, ¿me repites por favor?";
    }
  }
};
