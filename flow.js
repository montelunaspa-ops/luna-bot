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

/* ===========================================================
   🔵 Crear estado inicial
   =========================================================== */
function iniciarFlujo(state = {}, phone) {
  return {
    phone,
    step: "solicitar_comuna",
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
   🔵 Fecha de entrega automática
   =========================================================== */
function calcularFechaEntrega() {
  const hoy = new Date();
  const d = hoy.getDay(); // 0 domingo, 6 sábado

  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);

  // Ajustes fin de semana
  if (d === 6) manana.setDate(hoy.getDate() + 2);
  if (d === 0) manana.setDate(hoy.getDate() + 1);

  return manana.toISOString().split("T")[0];
}

/* ===========================================================
   🔵 Pregunta según paso
   =========================================================== */
function preguntaSegunPaso(step) {
  const preguntas = {
    solicitar_comuna: "¿En qué comuna será el despacho?",
    tomar_pedido: "¿Qué productos deseas pedir?",
    solicitar_nombre: "¿Cuál es tu nombre y apellido?",
    solicitar_direccion: "¿Cuál es la dirección exacta?",
    solicitar_telefono2:
      "¿Tienes otro teléfono de contacto? Si no, escribe *no*.",
    confirmar: "¿Confirmas el pedido? Escribe *sí*.",
  };
  return preguntas[step] || "¿En qué puedo ayudarte?";
}

/* ===========================================================
   🔵 PROCESAR MENSAJE DEL CLIENTE
   =========================================================== */
async function procesarPaso(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const texto = info.texto || mensaje;

  /* -----------------------------------------------------------
     🔵 1) SI ES PREGUNTA → GPT RESPONDE + SE MANTIENE EL FLUJO
     ----------------------------------------------------------- */
  if (info.intencion === "pregunta") {
    const resp = await responderConocimiento(info.pregunta || texto);
    return `${resp}\n\n${preguntaSegunPaso(state.step)}`;
  }

  /* -----------------------------------------------------------
     🔵 2) PASO: SOLICITAR COMUNA
     ----------------------------------------------------------- */
  if (state.step === "solicitar_comuna") {
    let comuna = comunaValida(mensaje);

    // Si GPT detecta comuna válida pero fuera de cobertura
    if (!comuna) {
      const r = await validarComunaChile(mensaje); // "SI: X" o "NO"
      if (r.startsWith("SI")) {
        const real = r.replace("SI:", "").trim();

        if (!rules.comunasCobertura.includes(real)) {
          state.entrega = "retiro";
          state.comuna = real;
          state.step = "tomar_pedido";

          return (
            `No tenemos reparto en *${real}* 😔\n` +
            "Pero puedes retirar en *Calle Chacabuco 1120, Santiago Centro*.\n" +
            "¿Qué productos deseas pedir?"
          );
        }

        comuna = real;
      }
    }

    if (!comuna) {
      return `No pude reconocer la comuna 😅\nPor favor indícame nuevamente la comuna.`;
    }

    // Comuna válida dentro de cobertura
    state.comuna = comuna;
    state.horarioEntrega =
      rules.horarios[comuna] || "10:00–13:00 (horario general)";
    state.step = "tomar_pedido";

    return (
      `Perfecto 😊 hacemos despacho en *${comuna}*.\n` +
      `Horario estimado: *${state.horarioEntrega}*.\n` +
      "¿Qué productos deseas pedir?"
    );
  }

  /* -----------------------------------------------------------
     🔵 3) PASO: TOMAR PEDIDO
     ----------------------------------------------------------- */
  if (state.step === "tomar_pedido") {
    const lower = texto.toLowerCase();

    if (
      lower.includes("nada más") ||
      lower.includes("nada mas") ||
      lower.includes("eso es todo") ||
      lower === "listo"
    ) {
      if (state.pedido.length === 0) {
        return "Aún no has pedido nada 😅 ¿Qué deseas pedir?";
      }
      state.step = "solicitar_nombre";
      return "Perfecto 😊 ¿Cuál es tu nombre y apellido?";
    }

    // Añadir producto genérico
    state.pedido.push(texto);
    await guardarPedidoTemporal(state.phone, state.pedido);

    return (
      "Anotado 😊\n" +
      "Si deseas agregar algo más, indícalo.\n" +
      "Cuando termines, escribe *nada más*."
    );
  }

  /* -----------------------------------------------------------
     🔵 4) NOMBRE
     ----------------------------------------------------------- */
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = mensaje;
    state.step = "solicitar_direccion";
    return "Gracias 😊 ¿Cuál es la dirección exacta?";
  }

  /* -----------------------------------------------------------
     🔵 5) DIRECCIÓN
     ----------------------------------------------------------- */
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = mensaje;
    state.step = "solicitar_telefono2";
    return "¿Tienes otro teléfono de contacto? Si no, escribe *no*.";
  }

  /* -----------------------------------------------------------
     🔵 6) TELÉFONO 2
     ----------------------------------------------------------- */
  if (state.step === "solicitar_telefono2") {
    const l = texto.toLowerCase();
    state.datos.telefono2 = l === "no" ? "" : mensaje;

    state.fechaEntrega = calcularFechaEntrega();
    state.step = "confirmar";

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

Entrega estimada: ${state.fechaEntrega} (${state.horarioEntrega})

Si está todo correcto, escribe *sí* para confirmar.
`;

    return resumen;
  }

  /* -----------------------------------------------------------
     🔵 7) CONFIRMACIÓN DE PEDIDO
     ----------------------------------------------------------- */
  if (state.step === "confirmar") {
    const l = texto.toLowerCase();

    if (l.startsWith("si") || l.includes("confirm")) {
      if (state.clienteNuevo) {
        await guardarClienteNuevo(
          state.phone,
          state.datos.nombre,
          state.datos.direccion,
          state.datos.telefono2,
          state.comuna
        );
      }

      await guardarPedidoCompleto(state);
      state.step = "finalizado";

      return (
        "¡Perfecto! Tu pedido quedó confirmado ✅\n" +
        "Gracias por preferir *Delicias Monte Luna* 🌙✨"
      );
    }

    return "Para confirmar escribe *sí*. Si deseas modificar algo, indícalo.";
  }

  /* -----------------------------------------------------------
     🔵 8) FINALIZADO
     ----------------------------------------------------------- */
  if (state.step === "finalizado") {
    return "Tu pedido ya fue confirmado 😊\nSi deseas hacer otro pedido, escribe *Hola*.";
  }

  return "No entendí bien 😅 ¿Puedes repetirlo?";
}

module.exports = {
  iniciarFlujo,
  procesarPaso
};
