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
   🟢 Crear estado del flujo
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
   🟢 Fecha de entrega
   =========================================================== */
function calcularFechaEntrega() {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);

  const dia = hoy.getDay();
  if (dia === 6) manana.setDate(hoy.getDate() + 2);
  if (dia === 0) manana.setDate(hoy.getDate() + 1);

  return manana.toISOString().split("T")[0];
}

/* Pregunta según paso */
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
      return "¿Confirmas el pedido?";
    default:
      return "¿En qué puedo ayudarte?";
  }
}

/* ===========================================================
   🟢 PROCESADOR PRINCIPAL DEL FLUJO
   =========================================================== */
async function procesarPaso(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const emocion = respuestaEmocional(info.emocion);
  const texto = info.texto_normalizado || mensaje;

  /* ---------- PREGUNTAS ---------- */
  if (info.intencion === "pregunta") {
    const resp = await responderConocimiento(info.pregunta || texto);
    return `${emocion} ${resp}\n\n${preguntaSegunPaso(state.step)}`;
  }

  /* ---------- SALUDO ---------- */
  if (info.intencion === "saludo" && state.step === "inicio") {
    state.step = "solicitar_comuna";
    return (
      `${emocion} ${rules.bienvenida}\n\n` +
      `${rules.catalogo}\n¿En qué comuna será el despacho?`
    );
  }

  /* ---------- SOLICITAR COMUNA ---------- */
  if (state.step === "solicitar_comuna") {
    let comunaCliente = comunaValida(info.comuna || texto);

    if (!comunaCliente) {
      const comunaChile = await validarComunaChile(texto);

      if (!comunaChile || comunaChile === "NO") {
        return `${emocion} No pude reconocer esa comuna 😅\nIntenta nuevamente.`;
      }

      if (!rules.comunasCobertura.includes(comunaChile)) {
        state.entrega = "retiro";
        state.comuna = comunaChile;
        state.step = "tomar_pedido";

        return (
          `${emocion} No tenemos despacho en *${comunaChile}* 😔\n` +
          "Puedes retirar en *Calle Chacabuco 1120, Santiago Centro*.\n" +
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
      `Horario: *${state.horarioEntrega}*.\n` +
      "¿Qué deseas pedir?"
    );
  }

  /* ---------- TOMAR PEDIDO ---------- */
  if (state.step === "tomar_pedido") {
    const lower = texto.toLowerCase();

    if (
      lower.includes("nada más") ||
      lower.includes("nada mas") ||
      lower.includes("eso es todo") ||
      lower === "listo"
    ) {
      if (state.pedido.length === 0)
        return `${emocion} No has agregado productos 😅\n¿Qué deseas pedir?`;

      state.step = "solicitar_nombre";
      return `${emocion} Perfecto 😊 ¿Cuál es tu nombre y apellido?`;
    }

    state.pedido.push(info.pedido || texto);

    await guardarPedidoTemporal(state.phone, state.pedido);

    return `${emocion} Anotado 😊\nSi quieres agregar más productos, escribe.\nPara terminar, escribe *nada más*.`;
  }

  /* ---------- NOMBRE ---------- */
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = mensaje;
    state.step = "solicitar_direccion";
    return `${emocion} Gracias 😊 ¿Cuál es la dirección exacta?`;
  }

  /* ---------- DIRECCIÓN ---------- */
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = mensaje;
    state.step = "solicitar_telefono2";
    return `${emocion} Perfecto 🙌 ¿Tienes un teléfono adicional? Si no, escribe *no*.`;
  }

  /* ---------- TELÉFONO 2 ---------- */
  if (state.step === "solicitar_telefono2") {
    state.datos.telefono2 = mensaje.toLowerCase() === "no" ? "" : mensaje;

    state.fechaEntrega = calcularFechaEntrega();
    state.step = "confirmar";

    const textoEntrega =
      state.entrega === "domicilio"
        ? `Despacho en *${state.comuna}* el *${state.fechaEntrega}* entre *${state.horarioEntrega}*.`
        : `Retiro en Calle Chacabuco 1120 el *${state.fechaEntrega}*.`;

    const resumen = `Resumen del pedido 📦
${state.pedido.map((p) => "- " + p).join("\n")}

Datos del cliente 🧾
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Teléfonos: ${state.phone}${
      state.datos.telefono2 ? " / " + state.datos.telefono2 : ""
    }
• Comuna: ${state.comuna}

${textoEntrega}

Escribe *sí* para confirmar.`;

    return `${emocion} ${resumen}`;
  }

  /* ---------- CONFIRMAR ---------- */
  if (state.step === "confirmar") {
    if (texto.toLowerCase().startsWith("si")) {
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

      return `${emocion} ¡Pedido confirmado! 🎉\nGracias por preferir Delicias Monte Luna 🌙✨`;
    }

    return `${emocion} Para confirmar escribe *sí*.`;
  }

  /* ---------- FINALIZADO ---------- */
  if (state.step === "finalizado") {
    return `${emocion} Ya confirmamos tu pedido 😊\nSi deseas hacer otro, escribe *Hola*.`;
  }

  return `${emocion} No entendí 😅 ¿Puedes repetirlo?`;
}

module.exports = { iniciarFlujo, procesarPaso };
