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

/* ============================================
   🧠 MEMORIA DE SESIONES
============================================ */
const sesiones = {}; // { phone: state }

/* ============================================
   🟢 Crear estado inicial del flujo
============================================ */
function iniciarFlujo(phone) {
  return {
    phone,
    step: "solicitar_comuna",
    clienteNuevo: true,
    entrega: "domicilio",
    comuna: null,
    pedido: [],
    datos: { nombre: "", direccion: "", telefono2: "" },
    horarioEntrega: "",
    fechaEntrega: ""
  };
}

/* ============================================
   🟢 Calcular fecha de entrega
============================================ */
function calcularFechaEntrega() {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);

  const dia = hoy.getDay();

  if (dia === 6) manana.setDate(hoy.getDate() + 2);
  if (dia === 0) manana.setDate(hoy.getDate() + 1);

  return manana.toISOString().split("T")[0];
}

/* ============================================
   🟢 Pregunta según paso del flujo
============================================ */
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

/* ============================================
   🧠 PROCESAR CADA PASO DEL FLUJO
============================================ */
async function procesarPaso(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const emocion = respuestaEmocional(info.emocion);
  const texto = info.texto_normalizado || mensaje;

  /* =============================
     1) Resolver preguntas del cliente
     ============================= */
  if (info.intencion === "pregunta") {
    const respuesta = await responderConocimiento(info.pregunta || texto);
    return `${emocion} ${respuesta}\n\n${preguntaSegunPaso(state.step)}`;
  }

  /* =============================
     2) Flujo según pasos
     ============================= */

  // --- SALUDO EN PASOS INICIALES ---
  if (
    info.intencion === "saludo" &&
    (state.step === "inicio" || state.step === "solicitar_comuna")
  ) {
    return (
      `${emocion} ${rules.bienvenida}\n\n` +
      rules.catalogo +
      "\n" +
      rules.comunasTexto +
      "\n¿En qué comuna será el despacho?"
    );
  }

  // --- PASO: SOLICITAR COMUNA ---
  if (state.step === "solicitar_comuna") {
    let comunaCliente = comunaValida(info.comuna || texto);

    if (!comunaCliente) {
      const comunaChile = await validarComunaChile(texto);

      if (!comunaChile || comunaChile === "NO") {
        return `${emocion} No logré reconocer esa comuna 😅\nPor favor indícame nuevamente la comuna.`;
      }

      if (!rules.comunasCobertura.includes(comunaChile)) {
        state.entrega = "retiro";
        state.comuna = comunaChile;
        state.step = "tomar_pedido";
        return (
          `${emocion} No tenemos reparto en *${comunaChile}* 😔\n` +
          "Pero puedes retirar tu pedido en *Calle Chacabuco 1120, Santiago Centro*.\n" +
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
      `El horario aproximado de entrega es *${state.horarioEntrega}*.\n` +
      "¿Qué productos deseas pedir?"
    );
  }

  // --- PASO: TOMAR PEDIDO ---
  if (state.step === "tomar_pedido") {
    const low = texto.toLowerCase();

    if (["nada más", "nada mas", "eso es todo", "listo"].includes(low)) {
      if (state.pedido.length === 0) {
        return `${emocion} Aún no tengo ningún producto anotado 😅\nCuéntame, ¿qué deseas pedir?`;
      }
      state.step = "solicitar_nombre";
      return `${emocion} Perfecto 😊 Ahora, ¿cuál es tu nombre y apellido?`;
    }

    if (info.intencion === "pedido" && info.pedido) {
      state.pedido.push(info.pedido);
    } else {
      state.pedido.push(texto);
    }

    await guardarPedidoTemporal(state.phone, state.pedido);

    return (
      `${emocion} Anotado 😊\n` +
      "Si deseas agregar más productos, escríbelo.\n" +
      "Si ya terminaste, di *nada más*."
    );
  }

  // --- PASO: SOLICITAR NOMBRE ---
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = mensaje;
    state.step = "solicitar_direccion";
    return `${emocion} Gracias 😊 ¿Cuál es la dirección exacta para el despacho o retiro?`;
  }

  // --- PASO: SOLICITAR DIRECCIÓN ---
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = mensaje;
    state.step = "solicitar_telefono2";
    return `${emocion} Perfecto 🙌 ¿Tienes algún teléfono adicional? Si no, escribe *no*.`;
  }

  // --- PASO: SOLICITAR TELÉFONO 2 ---
  if (state.step === "solicitar_telefono2") {
    const low = texto.toLowerCase();

    if (low === "no" || low === "ninguno") {
      state.datos.telefono2 = "";
    } else {
      state.datos.telefono2 = mensaje;
    }

    state.fechaEntrega = calcularFechaEntrega();
    state.step = "confirmar";

    const entregaTxt =
      state.entrega === "domicilio"
        ? `Despacho en *${state.comuna}* el día *${state.fechaEntrega}* entre *${state.horarioEntrega}*`
        : `Retiro en *Calle Chacabuco 1120, Santiago Centro* el día *${state.fechaEntrega}*`;

    const resumen = `
Resumen del pedido 📦
${state.pedido.map((p) => "- " + p).join("\n")}

Datos del cliente 🧾
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Teléfono: ${state.phone}${state.datos.telefono2 ? " / " + state.datos.telefono2 : ""}
• Comuna: ${state.comuna}

${entregaTxt}

Si está todo correcto, escribe *sí* para confirmar.
`;

    return `${emocion} ${resumen}`;
  }

  // --- PASO: CONFIRMAR ---
  if (state.step === "confirmar") {
    const low = texto.toLowerCase();

    if (low.startsWith("si") || low === "sí" || low.includes("confirmo")) {
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
      return `${emocion} ¡Perfecto! Tu pedido quedó agendado ✅\nGracias por preferir *Delicias Monte Luna* 🌙✨`;
    }

    return `${emocion} Para confirmar escribe *sí*.`;
  }

  // --- FINALIZADO ---
  if (state.step === "finalizado") {
    return `${emocion} Tu pedido ya fue confirmado ✔️ Si quieres hacer otro pedido, escribe *Hola*.`;
  }

  return `${emocion} No entendí bien tu mensaje 😅 ¿Puedes repetirlo?`;
}

/* ============================================
   🧠 FUNCION PRINCIPAL QUE USA INDEX.JS
============================================ */
async function procesarMensaje(phone, mensaje) {
  if (!sesiones[phone]) {
    sesiones[phone] = iniciarFlujo(phone);
  }

  const state = sesiones[phone];

  const respuesta = await procesarPaso(state, mensaje);
  return respuesta;
}

module.exports = {
  procesarMensaje
};
