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

function calcularFechaEntrega() {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  if (hoy.getDay() === 6) manana.setDate(hoy.getDate() + 2);
  if (hoy.getDay() === 0) manana.setDate(hoy.getDate() + 1);
  return manana.toISOString().split("T")[0];
}

function preguntaSegunPaso(step) {
  switch (step) {
    case "solicitar_comuna": return "¿En qué comuna será el despacho?";
    case "tomar_pedido": return "¿Qué productos deseas pedir?";
    case "solicitar_nombre": return "¿Cuál es tu nombre y apellido?";
    case "solicitar_direccion": return "¿Cuál es la dirección exacta para el despacho?";
    case "solicitar_telefono2": return "¿Tienes algún teléfono adicional? Si no, escribe *no*.";
    case "confirmar": return "¿Confirmas el pedido?";
    default: return "¿En qué puedo ayudarte?";
  }
}

/* -----------------------------
   🔵  FLUJO PRINCIPAL
------------------------------*/
async function procesarPaso(state, mensaje) {

  const info = await interpretarMensaje(mensaje);
  const emocion = respuestaEmocional(info.emocion);
  const texto = info.texto_normalizado || mensaje.toLowerCase();

  /* -----------------------------
     1️⃣ SALUDO (NO PIDAS COMUNA)
  ------------------------------*/
  if (info.intencion === "saludo" && state.step === "inicio") {
    state.step = "solicitar_comuna";
    return (
      `${emocion} ${rules.bienvenida}\n\n` +
      rules.catalogo +
      "\n¿En qué comuna será el despacho?"
    );
  }

  /* -----------------------------
     2️⃣ PREGUNTAS
  ------------------------------*/
  if (info.intencion === "pregunta") {
    const resp = await responderConocimiento(info.pregunta || texto);
    return `${emocion} ${resp}\n\n${preguntaSegunPaso(state.step)}`;
  }

  /* -----------------------------
     3️⃣ SOLICITAR COMUNA
  ------------------------------*/
  if (state.step === "solicitar_comuna") {

    let comuna = comunaValida(texto);

    if (!comuna) {
      const comunaChile = await validarComunaChile(texto);

      if (!comunaChile || comunaChile === "NO") {
        return `${emocion} No pude reconocer la comuna 😅\nPor favor indícame nuevamente la comuna.`;
      }

      if (!rules.comunasCobertura.includes(comunaChile)) {
        state.entrega = "retiro";
        state.comuna = comunaChile;
        state.step = "tomar_pedido";
        return (
          `${emocion} No tenemos reparto en *${comunaChile}* 😔\n` +
          "Puedes retirar en *Calle Chacabuco 1120, Santiago Centro*.\n" +
          "¿Qué productos deseas pedir?"
        );
      }

      comuna = comunaChile;
    }

    state.comuna = comuna;
    state.horarioEntrega = rules.horarios[comuna];
    state.step = "tomar_pedido";

    return (
      `${emocion} Perfecto 😊 hacemos despacho en *${comuna}*.\n` +
      `Horario estimado: *${state.horarioEntrega}*.\n` +
      "¿Qué productos deseas pedir?"
    );
  }

  /* -----------------------------
     4️⃣ TOMAR PEDIDO
  ------------------------------*/
  if (state.step === "tomar_pedido") {
    const lower = texto;

    if (lower.includes("nada más") || lower.includes("nada mas")) {
      if (!state.pedido.length) {
        return `${emocion} Aún no tengo productos registrados 😅\n¿Qué deseas pedir?`;
      }
      state.step = "solicitar_nombre";
      return `${emocion} Perfecto 😊 ¿Cuál es tu nombre y apellido?`;
    }

    state.pedido.push(mensaje);

    try {
      await guardarPedidoTemporal(state.phone, state.pedido);
    } catch (e) {
      console.log("⚠️ Error guardando pedido temporal:", e);
    }

    return `${emocion} Anotado 😊\nSi deseas agregar algo más, escríbelo.\nSi ya terminaste, di *nada más*.`;
  }

  /* -----------------------------
     5️⃣ NOMBRE
  ------------------------------*/
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = mensaje;
    state.step = "solicitar_direccion";
    return `${emocion} Gracias 😊 ¿Cuál es la dirección exacta?`;
  }

  /* -----------------------------
     6️⃣ DIRECCIÓN
  ------------------------------*/
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = mensaje;
    state.step = "solicitar_telefono2";
    return `${emocion} ¿Tienes algún teléfono adicional?`;
  }

  /* -----------------------------
     7️⃣ TELÉFONO 2
  ------------------------------*/
  if (state.step === "solicitar_telefono2") {
    state.datos.telefono2 = (texto === "no") ? "" : mensaje;

    state.fechaEntrega = calcularFechaEntrega();
    state.step = "confirmar";

    const resumen =
`Resumen del pedido 📦
${state.pedido.map(p => "- " + p).join("\n")}

Cliente 🧾
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Teléfono: ${state.phone}${state.datos.telefono2 ? " / " + state.datos.telefono2 : ""}
• Comuna: ${state.comuna}

Fecha de entrega: ${state.fechaEntrega}

Si está todo correcto escribe *sí* para confirmar.`;

    return `${emocion} ${resumen}`;
  }

  /* -----------------------------
     8️⃣ CONFIRMAR
  ------------------------------*/
  if (state.step === "confirmar") {
    const lower = texto;

    if (lower === "sí" || lower === "si" || lower.includes("confirmo")) {

      try {
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
      } catch (e) {
        console.log("⚠️ Error guardando pedido final:", e);
      }

      state.step = "finalizado";

      return `${emocion} ¡Perfecto! Tu pedido quedó confirmado ✅\nGracias por preferir *Delicias Monte Luna* 🌙✨`;
    }

    return `${emocion} Para confirmar escribe *sí*.`;
  }

  /* -----------------------------
     9️⃣ FINALIZADO
  ------------------------------*/
  if (state.step === "finalizado") {
    return `${emocion} Tu pedido ya fue confirmado 😊 Si deseas hacer otro pedido, escribe *Hola*.`;
  }

  return `${emocion} No entendí bien 😅 ¿Puedes repetirlo?`;
}

module.exports = {
  iniciarFlujo,
  procesarPaso
};
