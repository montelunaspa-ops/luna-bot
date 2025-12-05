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
    clienteNuevo: false,
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
   🟢 Calcular fecha de entrega (al día siguiente)
   =========================================================== */
function calcularFechaEntrega() {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);

  const dia = hoy.getDay(); // 0 domingo, 6 sábado

  if (dia === 6) {
    // sábado → lunes
    manana.setDate(hoy.getDate() + 2);
  } else if (dia === 0) {
    // domingo → lunes
    manana.setDate(hoy.getDate() + 1);
  }

  return manana.toISOString().split("T")[0];
}

/* ===========================================================
   🟢 Pregunta según paso del flujo
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
      return "¿Tienes algún teléfono adicional? Si no, escribe *no*.";
    case "confirmar":
      return "¿Confirmas el pedido? Escribe *sí* para confirmar.";
    default:
      return "¿En qué puedo ayudarte?";
  }
}

/* ===========================================================
   🟢 PROCESAR CADA MENSAJE
   =========================================================== */
async function procesarPaso(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const emocion = respuestaEmocional(info.emocion);
  const texto = info.texto_normalizado || mensaje;

  /* ===========================================================
     🔵 1) Las preguntas SIEMPRE se responden con rules + GPT
     =========================================================== */
  if (info.intencion === "pregunta") {
    const resp = await responderConocimiento(info.pregunta || texto);
    return `${emocion} ${resp}\n\n${preguntaSegunPaso(state.step)}`;
  }

  /* ===========================================================
     🔵 2) Saludo en pasos iniciales
     =========================================================== */
  if (
    info.intencion === "saludo" &&
    (state.step === "inicio" || state.step === "solicitar_comuna")
  ) {
    state.step = "solicitar_comuna";
    return (
      `${emocion} ${rules.bienvenida}\n\n` +
      rules.catalogo +
      "\n" +
      rules.comunasTexto +
      "\n¿En qué comuna será el despacho?"
    );
  }

  /* ===========================================================
     🟣 3) PASO: SOLICITAR COMUNA
     =========================================================== */
  if (state.step === "solicitar_comuna") {
    // Si el cliente menciona productos antes de comuna
    if (info.intencion === "pedido") {
      return (
        `${emocion} ¡Claro! Te ayudo con eso 😊\n` +
        "Pero antes necesito saber la comuna para validar el despacho.\n\n" +
        "¿En qué comuna será el despacho?"
      );
    }

    // Primero intentamos leer comuna según reglas
    let comunaCliente = comunaValida(info.comuna || texto);

    // Validación extendida con GPT: comuna real de Chile
    if (!comunaCliente) {
      const comunaChile = await validarComunaChile(texto);

      // No es comuna
      if (!comunaChile || comunaChile === "NO") {
        return (
          `${emocion} No logré reconocer esa comuna 😅\n` +
          "Por favor indícame nuevamente la comuna."
        );
      }

      // Es comuna real pero fuera de cobertura → retiro
      if (!rules.comunasCobertura.includes(comunaChile)) {
        state.entrega = "retiro";
        state.comuna = comunaChile;
        state.step = "tomar_pedido";

        return (
          `${emocion} No tenemos reparto en *${comunaChile}* 😔\n` +
          "Pero puedes retirar tu pedido en *Calle Chacabuco 1120, Santiago Centro*.\n" +
          "Cuéntame, ¿qué productos deseas pedir?"
        );
      }

      comunaCliente = comunaChile;
    }

    // Comuna válida dentro de la cobertura
    state.comuna = comunaCliente;
    state.horarioEntrega = rules.horarios[comunaCliente];
    state.entrega = "domicilio";
    state.step = "tomar_pedido";

    return (
      `${emocion} Perfecto 😊 hacemos despacho en *${comunaCliente}*.\n` +
      `El horario aproximado de entrega es *${state.horarioEntrega}*.\n` +
      "¿Qué productos deseas pedir?"
    );
  }

  /* ===========================================================
     🟠 4) PASO: TOMAR PEDIDO
     =========================================================== */
  if (state.step === "tomar_pedido") {
    const lower = texto.toLowerCase();

    // Finalización de pedido
    if (
      lower.includes("nada más") ||
      lower.includes("nada mas") ||
      lower.includes("eso es todo") ||
      lower === "listo"
    ) {
      if (state.pedido.length === 0) {
        return (
          `${emocion} Aún no tengo ningún producto anotado 😅\n` +
          "Cuéntame, ¿qué te gustaría pedir?"
        );
      }
      state.step = "solicitar_nombre";
      return `${emocion} Perfecto 😊 Ahora, ¿cuál es tu nombre y apellido?`;
    }

    // Registrar ítem
    if (info.intencion === "pedido" && info.pedido) {
      state.pedido.push(info.pedido);
    } else {
      state.pedido.push(texto);
    }

    await guardarPedidoTemporal(state.phone, state.pedido);

    return (
      `${emocion} Anotado 😊\n` +
      "Si deseas agregar algo más, escríbelo.\n" +
      "Si ya terminaste, dime *nada más*."
    );
  }

  /* ===========================================================
     🟡 5) PASO: SOLICITAR NOMBRE
     =========================================================== */
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = mensaje;
    state.step = "solicitar_direccion";
    return `${emocion} Gracias 😊 ¿Cuál es la dirección exacta para el despacho o retiro?`;
  }

  /* ===========================================================
     🟡 6) PASO: SOLICITAR DIRECCIÓN
     =========================================================== */
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = mensaje;
    state.step = "solicitar_telefono2";
    return (
      `${emocion} Perfecto 🙌\n` +
      "¿Tienes algún teléfono adicional? Si no, escribe *no*."
    );
  }

  /* ===========================================================
     🟡 7) PASO: SOLICITAR TELÉFONO 2
     =========================================================== */
  if (state.step === "solicitar_telefono2") {
    const lower = texto.toLowerCase();

    if (lower === "no" || lower === "ninguno") {
      state.datos.telefono2 = "";
    } else {
      state.datos.telefono2 = mensaje;
    }

    state.fechaEntrega = calcularFechaEntrega();
    state.step = "confirmar";

    const textoEntrega =
      state.entrega === "domicilio"
        ? `Despacho en *${state.comuna}* el día *${state.fechaEntrega}* entre *${state.horarioEntrega}*.`
        : `Retiro en *Calle Chacabuco 1120, Santiago Centro* el día *${state.fechaEntrega}*.`;

    const resumen =
`Resumen del pedido 📦
${state.pedido.map((p) => "- " + p).join("\n")}

Datos del cliente 🧾
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Teléfono: ${state.phone}${state.datos.telefono2 ? " / " + state.datos.telefono2 : ""}
• Comuna: ${state.comuna}

${textoEntrega}

Si está todo correcto, escribe *sí* para confirmar.`;

    return `${emocion} ${resumen}`;
  }

  /* ===========================================================
     🟢 8) PASO: CONFIRMAR PEDIDO
     =========================================================== */
  if (state.step === "confirmar") {
    const lower = texto.toLowerCase();

    if (lower.startsWith("si") || lower === "sí" || lower.includes("confirmo")) {
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

      return (
        `${emocion} ¡Perfecto! Tu pedido quedó agendado ✅\n` +
        "Gracias por preferir *Delicias Monte Luna* 🌙✨"
      );
    }

    return (
      `${emocion} Para confirmar, escribe *sí*.\n` +
      "Si necesitas modificar algo, dime qué deseas cambiar."
    );
  }

  /* ===========================================================
     🟣 9) ESTADO FINALIZADO
     =========================================================== */
  if (state.step === "finalizado") {
    return (
      `${emocion} Tu pedido ya fue confirmado ✅\n` +
      "Si deseas hacer un nuevo pedido, escribe *Hola*."
    );
  }

  /* ===========================================================
     🟥 10) SISTEMA DE RESCATE
     =========================================================== */
  return `${emocion} No entendí bien tu mensaje 😅 ¿Puedes repetirlo?`;
}

module.exports = {
  iniciarFlujo,
  procesarPaso
};
