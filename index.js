require("dotenv").config();
const express = require("express");
const app = express();
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

// -------------------------------------------
// 🔥 CONFIG OPENAI
// -------------------------------------------
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -------------------------------------------
// 🔥 CONFIG SUPABASE
// -------------------------------------------
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// -------------------------------------------
// 📌 Sesiones en memoria
// -------------------------------------------
const sesiones = {};

// -------------------------------------------
// 📌 Datos estáticos del negocio
// -------------------------------------------

const CATALOGO = `
📦 *CATÁLOGO DELICIAS MONTE LUNA*

🍰 *QUEQUES PERUANOS* — $8.500  
Sabores disponibles: Chocolate, Marmoleado, Piña, Vainilla, Naranja, Maracuyá  
Porciones: 14, 16 o sin cortar  
Tamaño: 28 cm de diámetro, 10 cm de alto aprox.  

🍪 *GALLETAS Y DELICIAS* — Bandejas de 20 unidades — $4.000  
Variedades: Rellena de Manjar, Alemana, Giro Coco, Almejitas, Lengua de Gato,  
Cocadas de Horno, Alfajorcito, Cachitos  

🧁 *MUFFINS*  
• Muffin Chips (6 unidades): $3.500  
• Muffins Premium Sabores Surtidos (6 unidades): $5.000  

🤩 *DELICIAS PREMIUM*  
• Alfajores Premium de Maicena (12 unidades): $6.000  
• Cachitos Manjar Premium (10 unidades): $6.000  

📦 *QUEQUE ARTESANAL RECTANGULAR*  
Sabores: Vainilla Chips, Manzana, Arándanos  
Precio: $3.000 c/u — Oferta: 4 por $10.000  
`;

const COMUNAS = [
  "Cerro Navia", "Cerrillos", "Conchalí", "Estación Central", "Independencia",
  "Lo Prado", "Lo Espejo", "Maipú", "Pedro Aguirre Cerda", "Pudahuel",
  "Quinta Normal", "Recoleta", "Renca", "Santiago Centro", "San Miguel", "San Joaquín"
];

// -------------------------------------------
// 🔥 INTÉRPRETE CON IA — CORREGIDO
// -------------------------------------------
async function interpretarMensaje(mensaje) {
  const prompt = `
Eres el analizador de intención del bot Luna.

Clasifica este mensaje en EXACTAMENTE uno de estos tipos:
- saludo
- pregunta
- comuna
- pedido
- otro

REGLAS:
• "hola", "holi", "buenas", "buenos días", "hola luna" → SIEMPRE saludo  
• "qué venden", "donde entregan", "precio", "venden X" → pregunta  
• Solo detecta comuna si es comuna de Chile  
• Si menciona un producto → pedido  
• Emoción: feliz, neutro, molesto  

RESPONDE SOLO EN JSON:
{
  "intencion": "",
  "texto_normalizado": "",
  "emocion": "",
  "comuna": "",
  "pedido": ""
}

Mensaje: "${mensaje}"
`;

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  let raw = r.choices[0].message.content;

  try {
    return JSON.parse(raw);
  } catch (e) {
    console.log("❌ Error interpretando JSON:", raw);
    return { intencion: "otro", texto_normalizado: mensaje, emocion: "neutro" };
  }
}

// -------------------------------------------
// 🔥 VALIDAR COMUNA CON IA
// -------------------------------------------
async function validarComunaIA(texto) {
  const prompt = `
El usuario escribió: "${texto}".

Tu tarea:
- Si es una comuna real de Chile → responde SOLO el nombre exacto.
- Si NO lo es → responde "NO".

Nada más.
`;

  const r = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0
  });

  return r.choices[0].message.content.trim();
}

// -------------------------------------------
// 🔥 EMOCIONES
// -------------------------------------------
function emo(e) {
  if (e === "feliz") return "😊";
  if (e === "molesto") return "😥";
  return "🙂";
}

// -------------------------------------------
// 🔥 Crear estado de flujo
// -------------------------------------------
function crearFlujo(phone) {
  return {
    phone,
    step: "inicio",
    comuna: null,
    pedido: [],
    datos: { nombre: "", direccion: "", telefono2: "" }
  };
}

// -------------------------------------------
// 🔥 Guardar historial en Supabase
// -------------------------------------------
async function guardarHistorial(phone, msg, tipo) {
  await supabase.from("historial").insert({
    telefono: phone,
    mensaje: msg,
    tipo,
    fecha: new Date().toISOString()
  });
}

// -------------------------------------------
// 🔥 Guardar pedido temporal
// -------------------------------------------
async function guardarPedidoTemporal(phone, orden) {
  await supabase.from("pedidos_temporales").upsert({
    telefono: phone,
    pedido: orden
  });
}

// -------------------------------------------
// 🔥 Guardar pedido final
// -------------------------------------------
async function guardarPedidoFinal(state) {
  await supabase.from("pedidos").insert({
    telefono: state.phone,
    pedido: state.pedido,
    nombre: state.datos.nombre,
    direccion: state.datos.direccion,
    telefono2: state.datos.telefono2,
    comuna: state.comuna,
    fecha_entrega: new Date().toISOString().split("T")[0],
    horario: "10:00 - 12:00"
  });
}

// -------------------------------------------
// 🔥 Procesar flujo completo
// -------------------------------------------
async function procesar(state, mensaje) {
  const info = await interpretarMensaje(mensaje);
  const e = emo(info.emocion);
  const t = info.texto_normalizado.toLowerCase();

  console.log("➡ INTENCIÓN:", info);

  // ---------------- SALUDO ----------------
  if (info.intencion === "saludo") {
    state.step = "solicitar_comuna";
    return `${e} ¡Hola! Soy Luna, asistente virtual de *Delicias Monte Luna* 🌙✨\n\n${CATALOGO}\n¿En qué comuna será el despacho?`;
  }

  // ---------------- PREGUNTA ----------------
  if (info.intencion === "pregunta") {
    if (t.includes("donde") || t.includes("entrega") || t.includes("reparte")) {
      return `${e} Realizamos despacho en:\n\n${COMUNAS.map(c => "• " + c).join("\n")}\n\n¿En qué comuna estás tú?`;
    }

    // Otras preguntas → IA responde
    const r = await responderConocimiento(mensaje);
    return `${e} ${r}`;
  }

  // ---------------- COMUNA ----------------
  if (state.step === "solicitar_comuna") {
    let comuna = await validarComunaIA(mensaje);

    if (comuna === "NO") {
      return `${e} No pude reconocer la comuna 😅\n¿Puedes repetirla?`;
    }

    if (!COMUNAS.includes(comuna)) {
      state.comuna = comuna;
      state.step = "tomar_pedido";
      return `${e} No tenemos despacho en *${comuna}* 😔\nPero puedes retirar en *Calle Chacabuco 1120, Santiago Centro*.\n¿Qué deseas pedir?`;
    }

    state.comuna = comuna;
    state.step = "tomar_pedido";
    return `${e} Perfecto 😊 hacemos despacho en *${comuna}*.\n¿Qué deseas pedir?`;
  }

  // ---------------- PEDIDO ----------------
  if (state.step === "tomar_pedido") {
    if (t.includes("nada más") || t.includes("nada mas") || t.includes("listo")) {
      state.step = "nombre";
      return `${e} Perfecto 😊 ¿Cuál es tu nombre y apellido?`;
    }

    state.pedido.push(mensaje);
    await guardarPedidoTemporal(state.phone, state.pedido);

    return `${e} Anotado 😊\n¿Algo más?`;
  }

  // ---------------- NOMBRE ----------------
  if (state.step === "nombre") {
    state.datos.nombre = mensaje;
    state.step = "direccion";
    return `${e} ¿Cuál es la dirección exacta?`;
  }

  // ---------------- DIRECCIÓN ----------------
  if (state.step === "direccion") {
    state.datos.direccion = mensaje;
    state.step = "telefono2";
    return `${e} ¿Tienes un teléfono adicional? Si no, escribe *no*.`;
  }

  // ---------------- TELÉFONO 2 ----------------
  if (state.step === "telefono2") {
    state.datos.telefono2 = mensaje.toLowerCase() === "no" ? "" : mensaje;
    state.step = "confirmar";

    return `${e} Resumen del pedido 📦
${state.pedido.map(p => "- " + p).join("\n")}

Cliente:
• ${state.datos.nombre}
• ${state.datos.direccion}
• Tel: ${state.phone}${state.datos.telefono2 ? " / " + state.datos.telefono2 : ""}
• Comuna: ${state.comuna}

Si está todo correcto, escribe *sí* para confirmar.`;
  }

  // ---------------- CONFIRMACIÓN ----------------
  if (state.step === "confirmar") {
    if (t.startsWith("si")) {
      await guardarPedidoFinal(state);
      state.step = "finalizado";
      return `${e} ¡Perfecto! Tu pedido quedó registrado ✅\nGracias por preferir *Delicias Monte Luna* 🌙✨`;
    }

    return `${e} Para confirmar escribe *sí*.`;
  }

  // ---------------- FINALIZADO ----------------
  if (state.step === "finalizado") {
    return `${e} Tu pedido ya fue confirmado 😊 Si deseas hacer uno nuevo, escribe *Hola*.`;
  }

  return `${e} No entendí 😅 ¿Puedes repetirlo?`;
}

// -------------------------------------------
// 🔥 DECODIFICAR BODY DE WHATAUTO
// -------------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.post("/whatsapp", async (req, res) => {
  const body = req.body;

  console.log("📩 BODY RECIBIDO:", body);

  const phone = (body.phone || "").replace(/\s+/g, "");
  const msg = body.message || "";

  if (!phone) return res.json({ reply: "Error: no llegó número." });

  if (!sesiones[phone]) sesiones[phone] = crearFlujo(phone);

  const state = sesiones[phone];

  const respuesta = await procesar(state, msg);

  await guardarHistorial(phone, msg, "cliente");
  await guardarHistorial(phone, respuesta, "bot");

  res.json({ reply: respuesta });
});

// -------------------------------------------
// 🔥 INICIAR SERVIDOR
// -------------------------------------------
app.listen(3000, () => console.log("🚀 Servidor iniciado en el puerto 3000"));
