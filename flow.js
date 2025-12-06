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
  guardarClienteNuevo,
} = require("./dbSave");

/* ===========================================================
   ESTADO INICIAL
=========================================================== */
function nuevoEstado(phone) {
  return {
    phone,
    step: "inicio",
    comuna: null,
    pedido: [],
    datos: { nombre: "", direccion: "", telefono2: "" },
    fechaEntrega: "",
    horarioEntrega: "",
    entrega: "domicilio",
    clienteNuevo: false
  };
}

/* ===========================================================
   FECHA ENTREGA (al día siguiente excepto domingo)
=========================================================== */
function calcularFechaEntrega() {
  const hoy = new Date();
  let fecha = new Date(hoy);
  fecha.setDate(hoy.getDate() + 1);

  const dia = fecha.getDay(); 
  if (dia === 0) fecha.setDate(fecha.getDate() + 1); 

  return fecha.toISOString().split("T")[0];
}

/* ===========================================================
   PREGUNTA AUTOMÁTICA SEGÚN PASO
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
      return "¿Tienes algún teléfono adicional? (si no, escribe *no*)";
    case "confirmar":
      return "¿Deseas confirmar el pedido? Escribe *sí* para confirmar.";
    default:
      return "¿En qué puedo ayudarte?";
  }
}

/* ===========================================================
   PROCESAR MENSAJE
=========================================================== */
async function procesarPaso(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const emocion = respuestaEmocional(info.emocion);
  const texto = info.texto_normalizado || mensaje;

  /* === 1) Preguntas con reglas === */
  if (info.intencion === "pregunta") {
    const resp = await responderConocimiento(texto);
    return `${emocion} ${resp}\n\n${preguntaSegunPaso(state.step)}`;
  }

  /* === 2) Saludo inicial === */
  if (state.step === "inicio" && info.intencion === "saludo") {
    state.step = "solicitar_comuna";
    return `${emocion} ${rules.bienvenida}\n\n${rules.catalogo}\n¿En qué comuna será el despacho?`;
  }

  /* === 3) SOLICITAR COMUNA === */
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

        return `${emocion} No tenemos reparto en *${comunaChile}* 😔 pero puedes retirar tu pedido en *Santiago Centro*.\n¿Qué productos deseas pedir?`;
      }

      comuna = comunaChile;
    }

    state.comuna = comuna;
    state.horarioEntrega = "Durante la mañana"; 
    state.entrega = "domicilio";
    state.step = "tomar_pedido";

    return `${emocion} Perfecto 😊 hacemos despacho en *${comuna}*.\n¿Qué productos deseas pedir?`;
  }

  /* === 4) TOMAR PEDIDO === */
  if (state.step === "tomar_pedido") {
    const lower = texto.toLowerCase();

    if (
      lower.includes("nada más") ||
      lower.includes("nada mas") ||
      lower.includes("eso es todo") ||
      lower === "listo"
    ) {
      if (state.pedido.length === 0) {
        return `${emocion} No anoté ningún producto 😅 ¿qué deseas pedir?`;
      }

      state.step = "solicitar_nombre";
      return `${emocion} Perfecto 😊 ¿Cuál es tu nombre y apellido?`;
    }

    state.pedido.push(texto);
    await guardarPedidoTemporal(state.phone, state.pedido);

    return `${emocion} Anotado 😊\nSi deseas agregar algo más, escríbelo.\nSi ya terminaste, escribe *nada más*.`;
  }

  /* === 5) NOMBRE === */
  if (state.step === "solicitar_nombre") {
    state.datos.nombre = mensaje;
    state.step = "solicitar_direccion";
    return `${emocion} ¿Cuál es la dirección exacta para el despacho?`;
  }

  /* === 6) DIRECCIÓN === */
  if (state.step === "solicitar_direccion") {
    state.datos.direccion = mensaje;
    state.step = "solicitar_telefono2";
    return `${emocion} ¿Tienes algún teléfono adicional? (si no, escribe *no*)`;
  }

  /* === 7) TELÉFONO 2 === */
  if (state.step === "solicitar_telefono2") {
    const low = texto.toLowerCase();
    state.datos.telefono2 = (low === "no") ? "" : mensaje;

    state.fechaEntrega = calcularFechaEntrega();
    state.step = "confirmar";

    const resumen = `
Resumen del pedido 📦
${state.pedido.map(p => "- " + p).join("\n")}

Datos del cliente 🧾
• Nombre: ${state.datos.nombre}
• Dirección: ${state.datos.direccion}
• Teléfono: ${state.phone}${state.datos.telefono2 ? " / " + state.datos.telefono2 : ""}
• Comuna: ${state.comuna}

Entrega estimada: *${state.fechaEntrega}*
`;

    return `${emocion} ${resumen}\n¿Deseas confirmar el pedido?`;
  }

  /* === 8) CONFIRMAR === */
  if (state.step === "confirmar") {
    const ok = texto.toLowerCase();

    if (ok.startsWith("si") || ok.includes("confirmo")) {
      await guardarClienteNuevo(
        state.phone,
        state.datos.nombre,
        state.datos.direccion,
        state.datos.telefono2,
        state.comuna
      );

      await guardarPedidoCompleto(state);

      state.step = "finalizado";
      return `${emocion} ¡Pedido confirmado! 🎉\nGracias por preferir *Delicias Monte Luna* 🌙✨`;
    }

    return `${emocion} Para confirmar escribe *sí*.`;
  }

  /* === 9) FINALIZADO === */
  if (state.step === "finalizado") {
    return `${emocion} Tu pedido ya está confirmado 😊 Si deseas hacer otro, escribe *Hola*.`;
  }

  /* === Rescate === */
  return `${emocion} No entendí bien 😅 ¿Puedes repetirlo?`;
}

module.exports = { nuevoEstado, procesarPaso };
