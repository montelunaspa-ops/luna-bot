const rules = require("./rules");
const {
  interpretarMensaje,
  respuestaEmocional,
  responderConocimiento,
  validarComunaChile
} = require("./gpt");
const { comunaValida } = require("./utils");
const {
  guardarPedidoTemporal,
  guardarPedidoCompleto
} = require("./dbSave");

/* ======================================================
   ⚡ PROCESAR PASO DEL FLUJO
====================================================== */

async function procesarPaso(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const emocion = respuestaEmocional(info.emocion);

  /* =========================================
     🧠 1. SI ES UNA PREGUNTA → RESPUESTA GPT
  ========================================== */
  if (info.intencion === "pregunta") {
    const respuestaBot = await responderConocimiento(info.texto_normalizado);

    return (
      emocion +
      " " +
      respuestaBot +
      "\n\n" +
      obtenerPreguntaDelPaso(state.step)
    );
  }

  /* =========================================
     🧠 2. VALIDACIÓN INTELIGENTE DE COMUNA
  ========================================== */
  if (info.intencion === "comuna") {
    let comunaCliente = comunaValida(info.texto_normalizado);

    // 1️⃣ Si utils.js NO la reconoce → preguntamos a GPT
    if (!comunaCliente) {
      comunaCliente = await validarComunaChile(info.texto_normalizado);
    }

    // 2️⃣ Si GPT tampoco la reconoce
    if (!comunaCliente || comunaCliente === "NO") {
      return (
        emocion +
        " No logré reconocer esa comuna 😅\nPor favor indícame nuevamente la comuna."
      );
    }

    // 3️⃣ Si la comuna existe pero NO está en cobertura
    if (!rules.comunas.includes(comunaCliente)) {
      return (
        emocion +
        ` No tenemos reparto en *${comunaCliente}* 😔\n` +
        "Pero puedes retirar tu pedido en Calle Chacabuco 1120, Santiago Centro.\n" +
        "¿Deseas retirar?"
      );
    }

    // 4️⃣ Comuna válida dentro de cobertura
    state.comuna = comunaCliente;
    state.step = "pedir_productos";

    return (
      emocion +
      ` Perfecto 😊 hacemos despacho en *${comunaCliente}*.\n` +
      "¿Qué productos deseas solicitar?"
    );
  }

  /* =========================================
     🧠 3. SEGUIMIENTO NORMAL DEL FLUJO (RESTO)
  ========================================== */

  if (state.step === "pedir_productos") {
    state.pedido.push(info.texto_normalizado);
    await guardarPedidoTemporal(state.phone, state.pedido);

    return (
      emocion +
      " Anotado 😊 ¿Deseas agregar algo más o continuamos con los datos de despacho?"
    );
  }

  if (state.step === "datos_cliente") {
    state.datos.nombre = mensaje;
    state.step = "direccion";

    return emocion + " Perfecto 😊 ahora indícame tu dirección.";
  }

  if (state.step === "direccion") {
    state.datos.direccion = mensaje;
    state.step = "telefono2";

    return emocion + " ¿Tienes un teléfono adicional? Si no, escribe NO.";
  }

  if (state.step === "telefono2") {
    state.datos.telefono2 = mensaje.toLowerCase() === "no" ? null : mensaje;
    state.step = "confirmar";

    return (
      emocion +
      " ¡Perfecto! Aquí tienes un resumen de tu pedido para confirmar:\n\n" +
      `📦 *Pedido:* ${state.pedido.join(", ")}\n` +
      `🏠 *Dirección:* ${state.datos.direccion}\n` +
      `📞 *Teléfono:* ${state.datos.telefono2 ?? state.phone}\n` +
      `📍 *Comuna:* ${state.comuna}\n\n` +
      "¿Confirmas el pedido? (sí/no)"
    );
  }

  if (state.step === "confirmar") {
    if (info.intencion === "confirmacion") {
      await guardarPedidoCompleto(state);

      state.step = "finalizado";

      return emocion + " 🎉 ¡Tu pedido quedó agendado! Gracias por preferirnos. ✔️";
    }

    return emocion + " ¿Deseas confirmar el pedido? (sí/no)";
  }

  return (
    emocion + " No entendí bien tu mensaje 😅 ¿Puedes repetirlo?"
  );
}

function obtenerPreguntaDelPaso(step) {
  switch (step) {
    case "comuna":
      return "¿En qué comuna será el despacho?";
    case "pedir_productos":
      return "¿Qué productos deseas ordenar?";
    case "datos_cliente":
      return "¿Cuál es tu nombre completo?";
    case "direccion":
      return "Indícame tu dirección, por favor.";
    default:
      return "¿En qué puedo ayudarte?";
  }
}

module.exports = { procesarPaso };
