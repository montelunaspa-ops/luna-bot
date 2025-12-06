const rules = require("./rules");
const {
  interpretarMensaje,
  responderConocimiento,
  validarComunaChile
} = require("./gpt");
const { comunaValida } = require("./utils");
const {
  guardarPedidoTemporal,
  guardarPedidoCompleto,
  guardarClienteNuevo
} = require("./dbSave");

/* ============================================
   CREAR ESTADO INICIAL
============================================ */
function iniciarFlujo(state = {}, phone) {
  return {
    phone,
    step: "inicio", // 👈 empezamos en "inicio", NO en "solicitar_comuna"
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

/* ============================================
   FECHA DE ENTREGA (día siguiente, saltando domingo)
============================================ */
function calcularFechaEntrega() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0 domingo, 6 sábado
  const fecha = new Date(hoy);

  // por defecto: día siguiente
  fecha.setDate(hoy.getDate() + 1);

  // si hoy es sábado => entrega lunes (2 días)
  if (dia === 6) {
    fecha.setDate(hoy.getDate() + 2);
  }

  // si hoy es domingo => entrega lunes (1 día más)
  if (dia === 0) {
    fecha.setDate(hoy.getDate() + 1);
  }

  return fecha.toISOString().split("T")[0];
}

/* ============================================
   PREGUNTA SEGÚN PASO
============================================ */
function preguntaSegunPaso(step) {
  switch (step) {
    case "inicio":
    case "solicitar_comuna":
      return "¿En qué comuna será el despacho?";
    case "tomar_pedido":
      return "¿Qué productos deseas pedir?";
    case "solicitar_nombre":
      return "¿Cuál es tu nombre y apellido?";
    case "solicitar_direccion":
      return "¿Cuál es la dirección exacta para el despacho o retiro?";
    case "solicitar_telefono2":
      return "¿Tienes otro teléfono de contacto? Si no, escribe *no*.";
    case "confirmar":
      return "¿Confirmas el pedido? Escribe *sí* para confirmar.";
    default:
      return "¿En qué puedo ayudarte?";
  }
}

/* ============================================
   PROCESAR CADA MENSAJE
============================================ */
async function procesarPaso(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const texto = info.texto_normalizado || mensaje.toLowerCase();

  /* -----------------------------------------
     1) PRIMER PASO: INICIO
     ----------------------------------------- */
  if (state.step === "inicio") {
    // Siempre que entra un cliente nuevo, saludamos y mandamos catálogo
    state.step = "solicitar_comuna";
    return (
      `${rules.bienvenida}\n\n` +
      rules.catalogo +
      "\n¿En qué comuna será el despacho?"
    );
  }

  /* -----------------------------------------
     2) PREGUNTAS (en cualquier paso)
     ----------------------------------------- */
  if (info.intencion === "pregunta") {
    const pregunta = info.pregunta || mensaje;

    const lower = pregunta.toLowerCase();
    const esSobreComunas =
      lower.includes("donde") ||
      lower.includes("dónde") ||
      lower.includes("entrega") ||
      lower.includes("entregan") ||
      lower.includes("reparte") ||
      lower.includes("reparten") ||
      lower.includes("comuna");

    // Si es una pregunta sobre comunas/entregas → respondemos comunas
    if (esSobreComunas) {
      return (
        "Realizamos despacho en las siguientes comunas:\n" +
        rules.comunasTexto +
        "\n" +
        preguntaSegunPaso(state.step)
      );
    }

    // Cualquier otra pregunta → responder con baseConocimiento
    const resp = await responderConocimiento(pregunta);
    return `${resp}\n\n${preguntaSegunPaso(state.step)}`;
  }

  /* -----------------------------------------
     3) SOLICITAR COMUNA
     ----------------------------------------- */
  if (state.step === "solicitar_comuna") {
    let comuna = comunaValida(mensaje);

    if (!comuna) {
      const r = await validarComunaChile(mensaje); // "SI: X" o "NO"
      if (r.startsWith("SI")) {
        const real = r.replace("SI:", "").trim();

        // comuna real, pero ¿tiene cobertura?
        if (!rules.comunasCobertura.includes(real)) {
          state.entrega = "retiro";
          state.comuna = real;
          state.step = "tomar_pedido";

          return (
            `No tenemos reparto en *${real}* 😔\n` +
            "Pero puedes retirar tu pedido en *Calle Chacabuco 1120, Santiago Centro*.\n" +
            "¿Qué productos deseas pedir?"
          );
        }

        comuna = real;
      }
    }

    if (!comuna) {
      return (
        "No pude reconocer la comuna 😅\n" +
        "Por favor indícame nuevamente la comuna."
      );
    }

    // comuna válida y con cobertura
    state.comuna = comuna;
    state.horarioEntrega =
      rules.horarios[comuna] || "10:00–13:00 (horario aproximado)";
    state.entrega = "domicilio";
    state.step = "tomar_pedido";

    return (
      `Perfecto 😊 hacemos despacho en *${comuna}*.\n` +
      `El horario aproximado de entrega es *${state.horarioEntrega}*.\n` +
      "¿Qué productos deseas pedir?"
    );
  }

  /* -----------------------------------------
     4) TOMAR PEDIDO
     ----------------------------------------- */
  if (state.step === "tomar_pedido") {
    const lower = texto.toLowerCase().trim();

    // finalización de pedido
    if (
      lower === "nada mas" ||
      lower === "nada más" ||
      lower === "eso es todo" ||
      lower === "listo"
    ) {
      if (state.pedido.length === 0) {
        return "Aún no tengo ningún producto anotado 😅 ¿Qué deseas pedir?";
      }
      state.step = "solicitar_nombre";
      return "Perfecto 😊 Ahora, ¿cuál es tu nombre y apellido?";
    }

    // cualquier mensaje aquí se considera parte del pedido
    state.pedido.push(mensaje);
    await guardarPedidoTemporal(state.phone, state.pedido);

    return (
      "Anotado 😊\n" +
      "Si deseas agregar algo más, escríbelo.\n" +
      "Si ya terminaste, escribe *nada más*."
    );
  }

  /* -----------------------------------------
     5) NOMBRE
     ----------------------------------------- */
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = mensaje;
    state.step = "solicitar_direccion";
    return "Gracias 😊 ¿Cuál es la dirección exacta para el despacho o retiro?";
  }

  /* -----------------------------------------
     6) DIRECCIÓN
     ----------------------------------------- */
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = mensaje;
    state.step = "solicitar_telefono2";
    return "¿Tienes algún teléfono adicional? Si no, escribe *no*.";
  }

  /* -----------------------------------------
     7) TELÉFONO 2
     ----------------------------------------- */
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
        : `Retiro en *Calle Chacabuco 1120, Santiago Centro* el día *${state.fechaEntrega}* dentro de los horarios de retiro.`;

    const resumen = `
Resumen del pedido 📦
${state.pedido.map((p) => "- " + p).join("\n")}

Datos del cliente 🧾
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Teléfono: ${state.phone}${
      state.datos.telefono2 ? " / " + state.datos.telefono2 : ""
    }
• Comuna: ${state.comuna}

${textoEntrega}

Si está todo correcto, escribe *sí* para confirmar.
`;

    return resumen;
  }

  /* -----------------------------------------
     8) CONFIRMAR
     ----------------------------------------- */
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
        "¡Perfecto! Tu pedido quedó agendado ✅\n" +
        "Gracias por preferir *Delicias Monte Luna* 🌙✨ ✅"
      );
    }

    return (
      "Para confirmar escribe *sí*.\n" +
      "Si necesitas modificar algo, dime qué deseas cambiar."
    );
  }

  /* -----------------------------------------
     9) FINALIZADO
     ----------------------------------------- */
  if (state.step === "finalizado") {
    return "Tu pedido ya fue confirmado ✅\nSi deseas hacer un nuevo pedido, escribe *Hola*.";
  }

  return "No entendí bien tu mensaje 😅 ¿Puedes repetirlo?";
}

module.exports = {
  iniciarFlujo,
  procesarPaso
};
