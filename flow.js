const rules = require("./rules");
const { comunaValida } = require("./utils");
const {
  guardarPedidoTemporal,
  guardarClienteNuevo,
  guardarPedidoCompleto
} = require("./dbSave");

module.exports = {
  /* ======================================================
     INICIO DE SESIÓN POR CLIENTE
  ====================================================== */
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
     PROCESADOR CENTRAL DEL FLUJO
  ====================================================== */
  async procesarPaso(state, msg) {
    msg = msg.trim().toLowerCase();

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
        const comunaOriginal = msg;
        const comuna = comunaValida(comunaOriginal);

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

        // Cliente terminó de pedir
        if (msg.includes("nada más") || msg.includes("nada mas")) {
          state.step = "solicitar_nombre";
          return "Perfecto. ¿Cuál es tu nombre y apellido?";
        }

        // Agregar ítem al pedido
        state.pedido.push(msg);

        // Guardar pedido temporal en Supabase
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
        state.datos.telefono2 = msg === "no" ? "" : msg;

        // Generar fecha de entrega (día siguiente)
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
         7. Confirmación
      ======================= */
      case "confirmar":

        if (msg !== "sí" && msg !== "si") {
          return "Para confirmar el pedido escribe *sí*.";
        }

        // Guardar cliente nuevo si corresponde
        if (state.clienteNuevo) {
          await guardarClienteNuevo(
            state.phone,
            state.datos.nombre,
            state.datos.direccion,
            state.datos.telefono2,
            state.comuna
          );
        }

        // Guardar pedido final
        await guardarPedidoCompleto(state);

        state.step = "finalizado";
        return "¡Perfecto! Tu pedido quedó agendado. ✅";

      /* =======================
         8. Conversación terminada
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
