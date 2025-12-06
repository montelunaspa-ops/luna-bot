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
   🟢 CREAR ESTADO INICIAL
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
   🟢 FECHA DE ENTREGA
   =========================================================== */
function calcularFechaEntrega() {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);

  const dia = hoy.getDay(); // domingo 0, sábado 6

  if (dia === 6) manana.setDate(hoy.getDate() + 2); // sábado → lunes
  if (dia === 0) manana.setDate(hoy.getDate() + 1); // domingo → lunes

  return manana.toISOString().split("T")[0];
}

/* ===========================================================
   🟢 PREGUNTA SEGÚN PASO
   =========================================================== */
function preguntaSegunPaso(step) {
  switch (step) {
    case "solicitar_comuna": return "¿En qué comuna será el despacho?";
    case "tomar_pedido": return "¿Qué productos deseas pedir?";
    case "solicitar_nombre": return "¿Cuál es tu nombre y apellido?";
    case "solicitar_direccion": return "¿Cuál es la dirección exacta para el despacho?";
    case "solicitar_telefono2": return "¿Tienes algún teléfono adicional? Si no, escribe *no*.";
    case "confirmar": return "¿Confirmas el pedido? Escribe *sí* para confirmar.";
    default: return "¿En qué puedo ayudarte?";
  }
}

/* ===========================================================
   🟣 PROCESAR MENSAJE
   =========================================================== */
async function procesarPaso(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const emocion = respuestaEmocional(info.emocion);
  const texto = info.texto_normalizado || mensaje;

  /* --------------------------
      PREGUNTAS
  --------------------------- */
  if (info.intencion === "pregunta") {
    const resp = await responderConocimiento(info.pregunta || texto);
    return `${emocion} ${resp}\n\n${preguntaSegunPaso(state.step)}`;
  }

  /* --------------------------
      SALUDO INICIAL
  --------------------------- */
  if (
    info.intencion === "saludo" &&
    (state.step === "inicio" || state.step === "solicitar_comuna")
  ) {
    state.step = "solicitar_comuna";
    return (
      `${emocion} ${rules.bienvenida}\n\n` +
      rules.catalogo
    );
  }

  /* --------------------------
      PASO 1: COMUNA
  --------------------------- */
  if (state.step === "solicitar_comuna") {

    if (info.intencion === "pedido") {
      return `${emocion} Antes necesito saber la comuna 😊\n¿En qué comuna será el despacho?`;
    }

    let comunaCliente = comunaValida(info.comuna || texto);

    if (!comunaCliente) {
      const comunaChile = await validarComunaChile(texto);

      if (!comunaChile || comunaChile === "NO") {
        return `${emocion} No pude reconocer la comuna 😅\nPor favor indícame nuevamente la comuna.`;
      }

      if (!rules.comunasCobertura.includes(comunaChile)) {
        state.entrega = "retiro";
        state.comuna = comunaChile;
        state.step = "tomar_pedido";

        return `${emocion} No tenemos reparto en *${comunaChile}* 😔\nPero puedes retirar en *Calle Chacabuco 1120, Santiago Centro*.\n¿Qué productos deseas pedir?`;
      }

      comunaCliente = comunaChile;
    }

    state.comuna = comunaCliente;
    state.horarioEntrega = rules.horarios[comunaCliente];
    state.entrega = "domicilio";
    state.step = "tomar_pedido";

    return `${emocion} Perfecto 😊 hacemos despacho en *${comunaCliente}*.\nHorario: *${state.horarioEntrega}*\n¿Qué productos deseas pedir?`;
  }

  /* --------------------------
      PASO 2: TOMAR PEDIDO
  --------------------------- */
  if (state.step === "tomar_pedido") {

    const lower = texto.toLowerCase();

    if (
      lower.includes("nada más") ||
      lower.includes("nada mas") ||
      lower.includes("eso es todo") ||
      lower === "listo"
    ) {

      if (state.pedido.length === 0) {
        return `${emocion} Aún no tengo productos 😅\n¿Qué deseas pedir?`;
      }

      state.step = "solicitar_nombre";
      return `${emocion} Perfecto 😊 Ahora, ¿cuál es tu nombre y apellido?`;
    }

    state.pedido.push(info.pedido || texto);

    await guardarPedidoTemporal(state.phone, state.pedido);

    return `${emocion} Anotado 😊\nSi deseas agregar algo más, escríbelo.\nCuando termines, escribe *nada más*.`;
  }

  /* --------------------------
      PASO 3: NOMBRE
  --------------------------- */
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = mensaje;
    state.step = "solicitar_direccion";
    return `${emocion} Gracias 😊 ¿Cuál es la dirección exacta?`;
  }

  /* --------------------------
      PASO 4: DIRECCIÓN
  --------------------------- */
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = mensaje;
    state.step = "solicitar_telefono2";
    return `${emocion} Perfecto 🙌\n¿Tienes algún teléfono adicional? Si no, escribe *no*.`;
  }

  /* --------------------------
      PASO 5: TELÉFONO 2
  --------------------------- */
  if (state.step === "solicitar_telefono2") {
    const lower = texto.toLowerCase();
    state.datos.telefono2 = lower === "no" ? "" : mensaje;

    state.fechaEntrega = calcularFechaEntrega();
    state.step = "confirmar";

    const resumen =
`Resumen del pedido 📦
${state.pedido.map(p => "- " + p).join("\n")}

Datos del cliente 🧾
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Teléfono: ${state.phone}${state.datos.telefono2 ? " / " + state.datos.telefono2 : ""}
• Comuna: ${state.comuna}

Entrega: ${
      state.entrega === "domicilio"
        ? `Despacho el *${state.fechaEntrega}* entre *${state.horarioEntrega}*`
        : `Retiro el *${state.fechaEntrega}* en *Calle Chacabuco 1120, Santiago Centro*`
    }

Si está todo correcto, escribe *sí* para confirmar.`;

    return `${emocion} ${resumen}`;
  }

  /* --------------------------
      PASO 6: CONFIRMAR
  --------------------------- */
  if (state.step === "confirmar") {
    const lower = texto.toLowerCase();

    if (lower.startsWith("si") || lower.includes("confirmo")) {

      if (state.clienteNuevo) {
        await guardarClienteNuevo(
          state.phone,
          state.datos.nombre,
          state.datos.direccion,
          state.datos.telefono2 || null,
          state.comuna
        );
      }

      await guardarPedidoCompleto(state);
      state.step = "finalizado";

      return `${emocion} ¡Perfecto! Tu pedido quedó agendado ✅\nGracias por preferir *Delicias Monte Luna* 🌙✨`;
    }

    return `${emocion} Para confirmar escribe *sí*.`;
  }

  /* --------------------------
      FINALIZADO
  --------------------------- */
  if (state.step === "finalizado") {
    return `${emocion} Tu pedido ya fue confirmado ✅\nSi deseas otro pedido, escribe *Hola*.`;
  }

  /* --------------------------
      FALLBACK
  --------------------------- */
  return `${emocion} No entendí bien tu mensaje 😅 ¿Puedes repetirlo?`;
}

module.exports = {
  iniciarFlujo,
  procesarPaso
};
