const rules = require("./rules");
const { comunaValida } = require("./utils");
const {
  guardarPedidoTemporal,
  guardarClienteNuevo,
  guardarPedidoCompleto
} = require("./dbSave");

module.exports = {
  /* ======================================================
     CREAR ESTADO DE SESIÓN
  ====================================================== */
  iniciarFlujo(state, phone) {
    return {
      phone,
      step: "bienvenida",
      pedido: [],
      clienteNuevo: false,
      datos: {
        nombre: "",
        direccion: "",
        telefono2: ""
      },
      comuna: "",
      fechaEntrega: "",
      horarioEntrega: "",
      ...state
    };
  },

  /* ======================================================
     PROCESAR CADA PASO DEL FLUJO
  ====================================================== */
  async procesarPaso(state, msg) {
    msg = msg.trim();

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
      case "solicitar_comuna":
        const comuna = comunaValida(msg);

        if (!comuna) {
          return "No tenemos reparto en esa comuna. ¿Deseas retirar en Calle Chacabuco 1120, Santiago Centro?";
        }

        state.comuna = comuna;
        state.horarioEntrega = rules.horarios[comuna];
        state.step = "tomar_pedido";

        return `Perfecto, entregamos entre ${state.horarioEntrega}. ¿Qué productos deseas pedir?`;

      /* =======================
         3. Tomar pedido
      ======================= */
      case "tomar_pedido":

        // Cliente terminó de pedir
        if (msg.toLowerCase().includes("nada más")) {
          state.step = "solicitar_nombre";
          return "Perfecto. ¿Cuál es tu nombre y apellido?";
        }

        // Agregar producto
        state.pedido.push(msg);

        // Guardar temporalmente pedido
        guardarPedidoTemporal(state.phone, state.pedido);

        return "¿Algo más? Cuando termines escribe *nada más*.";

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

        // Generar fecha de entrega (día siguiente)
        const mañana = new Date();
        mañana.setDate(mañana.getDate() + 1);
        state.fechaEntrega = mañana.toISOString().split("T")[0];

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
         7. Confirmar pedido
      ======================= */
      case "confirmar":

        if (msg.toLowerCase() !== "sí") {
          return "Para confirmar el pedido escribe *sí*.";
        }

        // Guardar cliente nuevo
        if (state.clienteNuevo) {
          guardarClienteNuevo(
            state.phone,
            state.datos.nombre,
            state.datos.direccion,
            state.datos.telefono2,
            state.comuna
          );
        }

        // Guardar pedido completo
        await guardarPedidoCompleto(state);

        state.step = "finalizado";
        return "¡Perfecto! Tu pedido quedó agendado. ✅";

      /* =======================
         8. Conversación terminada
      ======================= */
      case "finalizado":
        return "Tu pedido ya está confirmado. Si necesitas algo más, escríbeme 😊";

      /* =======================
         DEFAULT
      ======================= */
      default:
        return "No entendí, ¿me puedes repetir?";
    }
  }
};
