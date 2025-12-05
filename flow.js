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

/* Crear estado inicial del flujo para un teléfono */
function iniciarFlujo(state = {}, phone) {
  return {
    phone,
    step: "inicio",
    clienteNuevo: false,
    entrega: "domicilio", // domicilio | retiro
    comuna: null,
    pedido: [],
    datos: { nombre: "", direccion: "", telefono2: "" },
    horarioEntrega: "",
    fechaEntrega: "",
    ...state
  };
}

/* Calcular fecha de entrega según reglas (al día siguiente, domingo -> lunes) */
function calcularFechaEntrega() {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);

  // 0 = domingo, 6 = sábado
  const esSabado = hoy.getDay() === 6;
  const esDomingo = hoy.getDay() === 0;

  if (esSabado || esDomingo) {
    // pedidos sábado/domingo → lunes
    const diasHastaLunes = (8 - hoy.getDay()) % 7 || 1;
    manana.setDate(hoy.getDate() + diasHastaLunes);
  }

  return manana.toISOString().split("T")[0];
}

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
      return "¿Tienes otro número adicional? Si no, escribe NO.";
    case "confirmar":
      return "¿Confirmas el pedido? Escribe *sí* para confirmar.";
    default:
      return "¿En qué puedo ayudarte?";
  }
}

async function procesarPaso(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const emocion = respuestaEmocional(info.emocion);
  const texto = info.texto_normalizado || mensaje;

  // 1) Preguntas generales → responder según rules con GPT
  if (info.intencion === "pregunta") {
    const resp = await responderConocimiento(texto);
    return `${emocion} ${resp}\n\n${preguntaSegunPaso(state.step)}`;
  }

  // 2) Saludo en pasos iniciales
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

  /* ===================== PASO: SOLICITAR COMUNA ===================== */
  if (state.step === "solicitar_comuna") {
    // Intentamos leer comuna
    let comunaCliente = null;

    if (info.intencion === "comuna" && info.comuna) {
      comunaCliente = comunaValida(info.comuna);
    }

    if (!comunaCliente) {
      comunaCliente = comunaValida(texto);
    }

    // Si sigue sin reconocerse en la lista de cobertura, preguntamos a GPT
    if (!comunaCliente) {
      const comunaChile = await validarComunaChile(texto);

      if (!comunaChile || comunaChile === "NO") {
        return (
          `${emocion} No logré reconocer esa comuna 😅\n` +
          "Por favor indícame nuevamente la comuna."
        );
      }

      // Es comuna real de Chile pero fuera de cobertura
      if (!rules.comunasCobertura.includes(comunaChile)) {
        state.entrega = "retiro";
        state.comuna = comunaChile;
        state.step = "tomar_pedido";

        return (
          `${emocion} No tenemos reparto en *${comunaChile}* 😔\n` +
          "Pero puedes retirar tu pedido en *Calle Chacabuco 1120, Santiago Centro*.\n" +
          "Las entregas se coordinan para el día siguiente según nuestros horarios.\n\n" +
          "Cuéntame, ¿qué productos deseas pedir?"
        );
      }

      // Si llegamos aquí y la comunaChile sí está en cobertura
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
      "El despacho es *gratuito* por compras sobre $14.990; si es menor, el despacho cuesta *$2.400*.\n\n" +
      "¿Qué productos deseas pedir?"
    );
  }

  /* ===================== PASO: TOMAR PEDIDO ===================== */
  if (state.step === "tomar_pedido") {
    const lower = texto.toLowerCase();

    if (
      lower.includes("nada más") ||
      lower.includes("nada mas") ||
      lower.includes("eso es todo") ||
      lower === "listo"
    ) {
      if (state.pedido.length === 0) {
        return (
          `${emocion} Aún no tengo registrado ningún producto 😅\n` +
          "Cuéntame, ¿qué te gustaría pedir?"
        );
      }
      state.step = "solicitar_nombre";
      return `${emocion} Perfecto 😊 Ahora, ¿cuál es tu nombre y apellido?`;
    }

    // Si GPT marcó como pedido, usamos eso
    if (info.intencion === "pedido" && info.pedido) {
      state.pedido.push(info.pedido);
    } else {
      // Si no, tomamos el texto tal cual como descripción del ítem
      state.pedido.push(texto);
    }

    await guardarPedidoTemporal(state.phone, state.pedido);

    return (
      `${emocion} Anotado 😊\n` +
      "Si deseas agregar algo más, escríbelo.\n" +
      "Si ya terminaste, dime *nada más*."
    );
  }

  /* ===================== PASO: SOLICITAR NOMBRE ===================== */
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = mensaje;
    state.step = "solicitar_direccion";
    return `${emocion} Gracias 😊 ¿Cuál es la dirección exacta para el despacho o retiro?`;
  }

  /* ===================== PASO: SOLICITAR DIRECCIÓN ===================== */
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = mensaje;
    state.step = "solicitar_telefono2";
    return (
      `${emocion} Perfecto 🙌\n` +
      "¿Tienes algún teléfono adicional? Si no, escribe *no*."
    );
  }

  /* ===================== PASO: SOLICITAR TELÉFONO 2 ===================== */
  if (state.step === "solicitar_telefono2") {
    const lower = texto.toLowerCase();
    if (lower === "no" || lower === "ninguno" || lower === "ninguna") {
      state.datos.telefono2 = "";
    } else {
      state.datos.telefono2 = mensaje;
    }

    state.fechaEntrega = calcularFechaEntrega();
    state.step = "confirmar";

    const textoEntrega =
      state.entrega === "domicilio"
        ? `Despacho a domicilio en *${state.comuna}* el día *${state.fechaEntrega}* entre *${state.horarioEntrega}*.`
        : `Retiro en *Calle Chacabuco 1120, Santiago Centro* el día *${state.fechaEntrega}* dentro de los horarios de retiro.`;

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

  /* ===================== PASO: CONFIRMAR ===================== */
  if (state.step === "confirmar") {
    const lower = texto.toLowerCase();

    if (lower.startsWith("si") || lower === "sí" || lower.includes("confirmo")) {
      // guardar cliente nuevo si corresponde
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
      `${emocion} Para confirmar, por favor escribe *sí*.\n` +
      "Si necesitas cambiar algo, dime qué deseas modificar."
    );
  }

  /* ===================== ESTADO FINALIZADO O CUALQUIER OTRO ===================== */
  if (state.step === "finalizado") {
    return (
      `${emocion} Tu pedido ya fue confirmado ✅\n` +
      "Si deseas hacer un nuevo pedido, puedes escribir *Hola* y comenzamos de nuevo."
    );
  }

  return `${emocion} No entendí bien tu mensaje 😅 ¿Puedes repetirlo?`;
}

module.exports = {
  iniciarFlujo,
  procesarPaso
};
