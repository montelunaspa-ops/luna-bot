const rules = require("./rules");
const {
  interpretarMensaje,
  responderConocimiento,
  validarComunaChile,
  respuestaEmocional
} = require("./gpt");
const { comunaValida } = require("./utils");
const {
  guardarPedidoTemporal,
  guardarPedidoCompleto,
  guardarClienteNuevo
} = require("./dbSave");

/* ===========================================================
   🟢 Crear estado inicial del flujo
   =========================================================== */
function iniciarFlujo(state = {}, phone) {
  return {
    phone,
    step: "inicio",
    clienteNuevo: true,
    entrega: "domicilio",
    comuna: null,
    pedido: [],
    datos: { nombre: "", direccion: "", telefono2: "" },
    horarioEntrega: "",
    fechaEntrega: "",
    ...state
  };
}

/* ===========================================================
   🟢 Calcular fecha de entrega
   =========================================================== */
function calcularFechaEntrega() {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);

  const dia = hoy.getDay(); // Domingo 0, Sábado 6

  if (dia === 6) manana.setDate(hoy.getDate() + 2);
  if (dia === 0) manana.setDate(hoy.getDate() + 1);

  return manana.toISOString().split("T")[0];
}

/* ===========================================================
   🟢 Pregunta según paso
   =========================================================== */
function preguntaSegunPaso(step) {
  switch (step) {
    case "solicitar_comuna":
      return "¿En qué comuna será el despacho?";
    case "tomar_pedido":
      return "¿Qué productos deseas pedir?";
    case "solicitar_nombre":
      return "¿Cuál es tu nombre y apellido?";
    case "solicitar_direccion":
      return "¿Cuál es la dirección exacta para el despacho?";
    case "solicitar_telefono2":
      return "¿Tienes un teléfono adicional? Si no, escribe *no*.";
    case "confirmar":
      return "¿Confirmas el pedido? Escribe *sí* para confirmar.";
    default:
      return "¿En qué puedo ayudarte?";
  }
}

/* ===========================================================
   🟢 PROCESAR MENSAJE PRINCIPAL (ESTABLE)
   =========================================================== */
async function procesarPaso(state, mensaje) {
  try {
    const info = await interpretarMensaje(mensaje);
    const emocion = respuestaEmocional(info.emocion);
    const texto = info.texto_normalizado || mensaje;

    console.log("➡ INTENCIÓN DETECTADA:", info);

    /* ---------------------------------------------------------
       🔵 Saludo siempre funciona
       --------------------------------------------------------- */
    if (info.intencion === "saludo") {
      state.step = "solicitar_comuna";
      return (
        `${emocion} ${rules.bienvenida}\n\n` +
        rules.catalogo +
        `\n¿En qué comuna será el despacho?`
      );
    }

    /* ---------------------------------------------------------
       🔵 Preguntas generales → responder con catálogo/rules
       --------------------------------------------------------- */
    if (info.intencion === "pregunta") {
      const resp = await responderConocimiento(info.pregunta || texto);
      return `${emocion} ${resp}\n\n${preguntaSegunPaso(state.step)}`;
    }

    /* ---------------------------------------------------------
       🟣 Paso: solicitar comuna
       --------------------------------------------------------- */
    if (state.step === "solicitar_comuna") {
      let comunaCliente = comunaValida(info.comuna || texto);

      if (!comunaCliente) {
        const comunaChile = await validarComunaChile(texto);

        if (!comunaChile || comunaChile === "NO") {
          return `${emocion} No pude reconocer la comuna 😅\nPor favor indícala nuevamente.`;
        }

        if (!rules.comunasCobertura.includes(comunaChile)) {
          state.entrega = "retiro";
          state.comuna = comunaChile;
          state.step = "tomar_pedido";

          return (
            `${emocion} No tenemos despacho en *${comunaChile}* 😔\n` +
            `Puedes retirar en *Calle Chacabuco 1120, Santiago Centro*.\n` +
            "¿Qué productos deseas pedir?"
          );
        }

        comunaCliente = comunaChile;
      }

      state.comuna = comunaCliente;
      state.horarioEntrega = rules.horarios[comunaCliente];
      state.step = "tomar_pedido";

      return (
        `${emocion} Perfecto 😊 hacemos despacho en *${comunaCliente}*.\n` +
        `Horario estimado: *${state.horarioEntrega}*.\n` +
        "¿Qué productos deseas pedir?"
      );
    }

    /* ---------------------------------------------------------
       🟠 Paso: tomar pedido
       --------------------------------------------------------- */
    if (state.step === "tomar_pedido") {
      const lower = texto.toLowerCase();

      // Finalizar pedido
      if (
        lower.includes("nada más") ||
        lower.includes("nada mas") ||
        lower.includes("eso es todo") ||
        lower === "listo"
      ) {
        if (state.pedido.length === 0) {
          return `${emocion} Aún no tengo productos anotados 😅\n¿Qué deseas pedir?`;
        }

        state.step = "solicitar_nombre";
        return `${emocion} Perfecto 😊 ¿Cuál es tu nombre y apellido?`;
      }

      // Registrar pedido
      if (info.intencion === "pedido" && info.pedido) {
        state.pedido.push(info.pedido);
      } else {
        state.pedido.push(texto);
      }

      await guardarPedidoTemporal(state.phone, state.pedido);

      return `${emocion} Anotado 😊\n¿Deseas agregar algo más? Si no, escribe *nada más*.`;
    }

    /* ---------------------------------------------------------
       🟡 Solicitar nombre
       --------------------------------------------------------- */
    if (state.step === "solicitar_nombre") {
      state.datos.nombre = mensaje;
      state.step = "solicitar_direccion";
      return `${emocion} Gracias 😊 ¿Cuál es la dirección exacta?`;
    }

    /* ---------------------------------------------------------
       🟡 Solicitar dirección
       --------------------------------------------------------- */
    if (state.step === "solicitar_direccion") {
      state.datos.direccion = mensaje;
      state.step = "solicitar_telefono2";
      return `${emocion} Perfecto 🙌 ¿Tienes un teléfono adicional? Si no, escribe *no*.`;
    }

    /* ---------------------------------------------------------
       🟡 Teléfono adicional
       --------------------------------------------------------- */
    if (state.step === "solicitar_telefono2") {
      const lower = texto.toLowerCase();
      state.datos.telefono2 = lower === "no" ? "" : mensaje;

      state.fechaEntrega = calcularFechaEntrega();
      state.step = "confirmar";

      const textoEntrega =
        state.entrega === "domicilio"
          ? `Despacho en *${state.comuna}* el día *${state.fechaEntrega}* entre *${state.horarioEntrega}*.`
          : `Retiro en *Calle Chacabuco 1120* el día *${state.fechaEntrega}*.`;

      const resumen = `Resumen del pedido 📦
${state.pedido.map((p) => "- " + p).join("\n")}

Datos del cliente 🧾
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Teléfonos: ${state.phone}${state.datos.telefono2 ? " / " + state.datos.telefono2 : ""}
• Comuna: ${state.comuna}

${textoEntrega}

Si está todo correcto, escribe *sí* para confirmar.`;

      return `${emocion} ${resumen}`;
    }

    /* ---------------------------------------------------------
       🟢 Confirmar pedido
       --------------------------------------------------------- */
    if (state.step === "confirmar") {
      const lower = texto.toLowerCase();

      if (lower.startsWith("si") || lower.includes("confirmo")) {
        if (state.clienteNuevo) {
          await guardarClienteNuevo(
            state.phone,
            state.datos.nombre,
            state.datos.direccion,
            state.datos.telefono2 || state.phone,
            state.comuna
          );
        }

        await guardarPedidoCompleto(state);
        state.step = "finalizado";

        return `${emocion} ¡Perfecto! Tu pedido quedó registrado ✅\nGracias por preferir Delicias Monte Luna 🌙✨`;
      }

      return `${emocion} Para confirmar escribe *sí*.`;
    }

    /* ---------------------------------------------------------
       🟣 Pedido finalizado
       --------------------------------------------------------- */
    if (state.step === "finalizado") {
      return `${emocion} Ese pedido ya está confirmado 😊\nSi quieres hacer otro, escribe *Hola*.`;
    }

    /* ---------------------------------------------------------
       🟥 Fallback
       --------------------------------------------------------- */
    return `${emocion} No entendí 😅 ¿Puedes repetirlo?`;
  } catch (err) {
    console.error("❌ ERROR EN procesarPaso:", err);
    return "Hubo un error procesando tu mensaje 😥 Intenta nuevamente.";
  }
}

module.exports = {
  iniciarFlujo,
  procesarPaso
};
