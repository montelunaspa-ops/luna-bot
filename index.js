// ============================================================
// ===============   LUNA BOT - BLOQUE 1/3   ==================
// ===============   Dependencias y Config      ===============
// ============================================================

// Dependencias
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

// Inicialización express
const app = express();
const PORT = process.env.PORT || 3000;

// Parseo de JSON y x-www-form-urlencoded (WhatsAuto)
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================================
// ================== SESIONES EN MEMORIA ======================
// ============================================================

const sessions = {};

function getSession(phone) {
  if (!sessions[phone]) {
    sessions[phone] = {
      phone,
      knownClient: false,
      checkedClient: false,
      comuna: null,
      cart: [], // aquí va el listado de productos finales formateados
      customer: {
        nombre: null,
        direccion: null,
        telefono_alt: null,
      },
      delivery: {
        fecha_entrega: null,
        horario_aprox: null,
      },
      state: "inicio",
      orderSaved: false,
      editingExistingOrder: false,
      lastOrderId: null,
      history: [],
    };
  }
  return sessions[phone];
}

function pushHistory(session, role, content) {
  session.history.push({ role, content });
  if (session.history.length > 10) session.history = session.history.slice(-10);
}

// ============================================================
// ============== CATÁLOGO COMPLETO Y FORMATEADO ==============
// ============================================================

const CATALOGO_TEXTO = `
🍰 *QUEQUES PERUANOS*
   Sabores:
   • Chocolate
   • Marmoleado
   • Piña
   • Vainilla
   • Naranja
   • Maracuyá
   Porciones disponibles: 14, 16 o *sin cortar*
   Tamaño: 28 cm diámetro, 10 cm alto
   Precio: *$8.500*

🍪 *GALLETAS Y DELICIAS (bandejas de 20 unidades)*
   • Rellena de Manjar
   • Alemana
   • Giro Coco
   • Almejitas
   • Lengua de Gato
   • Cocadas de Horno
   • Alfajorcito
   • Cachitos
   Precio por bandeja: *$4.000*

🧁 *MUFFINS*
   • Muffin Chips (6 unidades) — *$3.500*
   • Muffins Premium Surtidos (6 unidades: 1 Chocolate, 1 Red Velvet, 
     1 Arándano, 1 Coco, 2 Chips) — *$5.000*

🤩 *DELICIAS PREMIUM*
   • Alfajores Premium de Maicena (12 unidades, 8–9 cm) — *$6.000*
   • Cachitos Manjar Premium (10 unidades, 11–12 cm) — *$6.000*

📦 *QUEQUE ARTESANAL RECTANGULAR*
   Sabores:
   • Vainilla Chips
   • Manzana
   • Arándanos
   Precio: *$3.000*
   Oferta: *4 unidades por $10.000*

Las entregas se realizan al día siguiente de realizar el pedido, excepto domingos.
¿En qué comuna vamos a despachar?
`;

// Comunas vertical
const COMUNAS_TEXTO = `
Comunas con despacho:
• Cerro Navia
• Cerrillos
• Conchalí
• Estación Central
• Independencia
• Lo Prado
• Lo Espejo (zona PAC → Vespucio)
• Maipú (antes de Vespucio entre Estación Central y Cerrillos)
• Pedro Aguirre Cerda
• Pudahuel (sur y norte)
• Quinta Normal
• Recoleta
• Renca
• Santiago Centro
• San Miguel
• San Joaquín
`;

const HORARIOS_ENTREGA = {
  "Cerro Navia": "11-13 hrs",
  Cerrillos: "11-13 hrs",
  Conchalí: "12-14 hrs",
  "Estación Central": "9-11 hrs",
  Independencia: "11-14 hrs",
  "Lo Prado": "11-13 hrs",
  "Lo Espejo": "10-12 hrs",
  Maipú: "10-12 hrs",
  "Pedro Aguirre Cerda": "10-12 hrs",
  Pudahuel: "12-14 hrs",
  "Quinta Normal": "10-13 hrs",
  Recoleta: "11-13 hrs",
  Renca: "10-13 hrs",
  "Santiago Centro": "9-11 hrs",
  "San Miguel": "10-12 hrs",
  "San Joaquín": "10-12 hrs",
};

// ============================================================
// ================== REGLAS DEL FLUJO LUNA ====================
// ============================================================

const FLOW_RULES = `
REGLAS OBLIGATORIAS DEL BOT LUNA (VERSIÓN EXTENDIDA):

1. Siempre responde en JSON válido.
2. Siempre usa "reply", "state" y "data".
3. El flujo general:
   - inicio → preguntar_comuna
   - preguntar_comuna → pedidos
   - pedidos → datos_despacho
   - datos_despacho → confirmacion
   - confirmacion → finalizado
4. PERO el flujo es flexible:
   El cliente puede agregar productos en CUALQUIER momento.
   Incluso después de confirmar.
5. Si agrega productos después de confirmar:
   - Cambiar session.orderSaved a false
   - Cambiar state a "pedidos"
   - Volver a generar resumen y pedir nueva confirmación.
6. Formato obligatorio de producto:
   {
     "descripcion": "Queque Peruano Chocolate - Porción 16",
     "cantidad": 2,
     "categoria": "queques peruanos"
   }
7. Merge obligatorio de productos:
   Si el cliente pide más unidades del mismo producto, sumar cantidad.
8. Si falta información (sabor, porción, cantidad), preguntar SOLO lo necesario.
9. Si el cliente pregunta cualquier cosa (horarios, precios, etc.), responder y retomar el flujo.
10. Comunas deben mostrarse SIEMPRE en lista vertical.
11. Catálogo debe mostrarse tabulado y limpio.
`;

// ============================================================
// ================== HELPERS PARA PRODUCTOS ===================
// ============================================================

// Detectar si dos productos son iguales según tu definición
function productosIguales(a, b) {
  return (
    a.descripcion.toLowerCase() === b.descripcion.toLowerCase() &&
    a.categoria.toLowerCase() === b.categoria.toLowerCase()
  );
}

// Agregar o mergear productos al carrito
function agregarProductoAlCarrito(carrito, nuevo) {
  for (let item of carrito) {
    if (productosIguales(item, nuevo)) {
      item.cantidad += nuevo.cantidad;
      return carrito;
    }
  }
  carrito.push(nuevo);
  return carrito;
}

// Crear descripción estándar
function construirDescripcionProducto({ categoria, sabor, porcion, especifico }) {
  if (categoria === "queques peruanos") {
    return `Queque Peruano ${sabor} - Porción ${porcion}`;
  }
  if (categoria === "galletas") {
    return `Galletas ${sabor} - Bandeja 20 unidades`;
  }
  if (categoria === "muffins") {
    return sabor; // Ejemplo: "Pack Muffins Premium"
  }
  if (categoria === "delicias premium") {
    return especifico;
  }
  if (categoria === "queque artesanal rectangular") {
    return `Queque Rectangular ${sabor}`;
  }
  return especifico;
}

// ============================================================
// ===============    HELPERS GENERALES EXTRA   ===============
// ============================================================

// Calcular fecha entrega
function calcularFechaEntrega() {
  const hoy = new Date();
  const entrega = new Date(hoy);
  entrega.setDate(entrega.getDate() + 1);

  if (entrega.getDay() === 0) entrega.setDate(entrega.getDate() + 1);

  return entrega.toISOString().split("T")[0];
}
// ============================================================
// ===============   LUNA BOT - BLOQUE 2/3   ==================
// ===============   Inteligencia y Parsing     ===============
// ============================================================

// ============================================================
// =============== ENSAMBLE DEL MEGA PROMPT IA ================
// ============================================================

const SYSTEM_PROMPT = `
Eres *Luna*, asistente virtual de Delicias Monte Luna.
Debes responder SIEMPRE en JSON válido con este formato exacto:

{
  "reply": "texto al cliente",
  "state": "inicio | preguntar_comuna | pedidos | datos_despacho | confirmacion | finalizado",
  "data": {
    "comuna": null,
    "productos": [],
    "datos_cliente": {
      "nombre": null,
      "direccion": null,
      "telefono_alt": null
    },
    "pedido_completo": false,
    "confirmado": false,
    "horario_entrega": null,
    "fecha_entrega": null
  }
}

REGLAS CRÍTICAS:
1. SIEMPRE responde JSON válido.
2. El flujo es FLEXIBLE: el cliente puede agregar productos en cualquier momento.
3. Si el cliente agrega productos después de confirmar:
   • marcar "confirmado": false
   • regresar a state: "pedidos"
4. Productos siempre deben ir en este formato:

{
  "descripcion": "Queque Peruano Chocolate - Porción 16",
  "cantidad": 2,
  "categoria": "queques peruanos"
}

5. Merge obligatorio de productos iguales.
6. Si falta sabor o porción, debes preguntar SOLO eso.
7. Si el mensaje es pregunta libre, respóndela y luego retoma el flujo.
8. Catálogo y comunas SIEMPRE en formato limpio, tabulado y vertical.
9. NO inventes productos.
10. NO inventes comunas.
11. NO inventes métodos de pago.

Aquí tienes el catálogo EXACTO:

${CATALOGO_TEXTO}

Comunas permitidas:

${COMUNAS_TEXTO}

Horarios aproximados (solo usar si la comuna es válida):
${Object.entries(HORARIOS_ENTREGA)
  .map(([c, h]) => `• ${c}: ${h}`)
  .join("\n")}

FLUJO BASE:
1. inicio → preguntar_comuna
2. validar comuna → pedidos
3. pedidos → datos_despacho
4. datos_despacho → confirmacion
5. confirmacion → finalizado
`;

// ============================================================
// ====================== askLunaAI() ==========================
// ============================================================

async function askLunaAI({ session, userMessage }) {
  const contexto = {
    state: session.state,
    comuna: session.comuna,
    cart: session.cart,
    customer: session.customer,
    delivery: session.delivery,
    orderSaved: session.orderSaved,
  };

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...session.history.map((h) => ({ role: h.role, content: h.content })),
    {
      role: "user",
      content: `Mensaje del cliente: "${userMessage}".\nContexto: ${JSON.stringify(
        contexto
      )}`,
    },
  ];

  let completion;
  try {
    completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
    });
  } catch (err) {
    console.error("❌ Error OpenAI:", err);
    return null;
  }

  let raw = completion.choices[0]?.message?.content || "";
  console.log("🤖 RAW IA:", raw);

  // Reintentar si no es JSON
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.log("⚠️ IA devolvió texto fuera de JSON, intentando corregir…");

    const fixed = raw.substring(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    try {
      parsed = JSON.parse(fixed);
    } catch {
      parsed = {
        reply:
          "Tuve un problema procesando el mensaje, ¿puedes repetirlo por favor? 😊",
        state: session.state,
        data: {},
      };
    }
  }

  return parsed;
}

// ============================================================
// =============== PARSEADOR DE PRODUCTOS ======================
// ============================================================

const SABORES_QUEQUE = [
  "chocolate",
  "marmoleado",
  "piña",
  "vainilla",
  "naranja",
  "maracuyá",
];

const PORCIONES = ["14", "16", "sin cortar"];

const GALLETAS = [
  "rellena de manjar",
  "alemana",
  "giro coco",
  "almejitas",
  "lengua de gato",
  "cocadas de horno",
  "alfajorcito",
  "cachitos",
];

// Detectar categoría por palabras clave
function detectarCategoria(msg) {
  msg = msg.toLowerCase();
  if (
    SABORES_QUEQUE.some((s) => msg.includes(s)) ||
    msg.includes("queque") ||
    msg.includes("torta")
  ) {
    return "queques peruanos";
  }
  if (GALLETAS.some((g) => msg.includes(g))) {
    return "galletas";
  }
  if (msg.includes("muffin") || msg.includes("premium")) {
    return "muffins";
  }
  if (msg.includes("alfajor") || msg.includes("cachito premium")) {
    return "delicias premium";
  }
  if (msg.includes("rectangular") || msg.includes("manzana")) {
    return "queque artesanal rectangular";
  }
  return null;
}

// Detectar sabor
function detectarSabor(msg) {
  msg = msg.toLowerCase();
  const all = [...SABORES_QUEQUE, ...GALLETAS];
  return all.find((s) => msg.includes(s)) || null;
}

// Detectar porción
function detectarPorcion(msg) {
  msg = msg.toLowerCase();
  if (msg.includes("14")) return "14";
  if (msg.includes("16")) return "16";
  if (msg.includes("sin cortar")) return "sin cortar";
  return null;
}

// Detectar cantidad
function detectarCantidad(msg) {
  const m = msg.match(/\b(\d+)\b/);
  return m ? parseInt(m[1]) : 1;
}

// Construye objeto producto final
function parsearProducto(msg) {
  const categoria = detectarCategoria(msg);
  if (!categoria) return null;

  const sabor = detectarSabor(msg);
  const porcion = categoria === "queques peruanos" ? detectarPorcion(msg) : null;
  const cantidad = detectarCantidad(msg);

  let descripcion = construirDescripcionProducto({
    categoria,
    sabor,
    porcion,
    especifico: msg,
  });

  return {
    descripcion,
    cantidad,
    categoria,
  };
}

// ============================================================
// ========== APLICAR RESPUESTA IA A LA SESIÓN =================
// ============================================================

function aplicarRespuestaAI(session, ai) {
  const data = ai.data || {};

  // Estado
  if (ai.state) session.state = ai.state;

  // Comuna
  if (data.comuna) {
    session.comuna = data.comuna;
  }

  // Merge productos
  if (Array.isArray(data.productos) && data.productos.length > 0) {
    for (const p of data.productos) {
      if (p.descripcion && p.cantidad) {
        session.cart = agregarProductoAlCarrito(session.cart, p);
      }
    }
  }

  // Datos cliente
  if (data.datos_cliente) {
    session.customer = {
      ...session.customer,
      ...data.datos_cliente,
    };
  }

  // Fecha entrega
  if (data.fecha_entrega) {
    session.delivery.fecha_entrega = data.fecha_entrega;
  }

  if (data.horario_entrega) {
    session.delivery.horario_aprox = data.horario_entrega;
  }

  // Confirmación
  if (data.confirmado === true) {
    session.state = "confirmacion";
  }

  return ai.reply || "Listo 😊";
}
// ============================================================
// ===============   LUNA BOT - BLOQUE 3/3   ==================
// ============   Endpoint, Guardado, Servidor    =============
// ============================================================

// ============================================================
// ================== GUARDAR CLIENTE EN BD ====================
// ============================================================

async function upsertCliente(session) {
  const { phone, customer, comuna } = session;

  const { nombre, direccion, telefono_alt } = customer;

  const { data, error } = await supabase
    .from("clientes")
    .upsert(
      {
        telefono: phone,
        nombre: nombre || null,
        direccion: direccion || null,
        comuna: comuna || null,
        telefono_alt: telefono_alt || null,
      },
      { onConflict: "telefono" }
    )
    .select()
    .single();

  if (error) console.error("❌ Error guardando cliente:", error);
  else console.log("✅ Cliente guardado:", data.telefono);
}

// ============================================================
// ================== GUARDAR PEDIDO EN BD =====================
// ============================================================

async function guardarPedido(session) {
  console.log("💾 Guardando pedido completo…");

  const fechaEntrega =
    session.delivery.fecha_entrega || calcularFechaEntrega();
  const horario =
    session.delivery.horario_aprox ||
    (session.comuna ? HORARIOS_ENTREGA[session.comuna] : null);

  const resumen =
    session.cart
      .map((p) => `${p.cantidad} × ${p.descripcion}`)
      .join(", ") || "Sin productos";

  // Crear pedido
  const { data: pedido, error: errorPedido } = await supabase
    .from("pedidos")
    .insert({
      cliente_telefono: session.phone,
      comuna: session.comuna,
      fecha_entrega: fechaEntrega,
      horario_aprox: horario,
      resumen_texto: resumen,
      estado: "pendiente",
    })
    .select()
    .single();

  if (errorPedido) {
    console.error("❌ Error insertando pedido:", errorPedido);
    return;
  }

  console.log("📦 Pedido creado con ID:", pedido.id);

  // Guardar detalle
  const detalles = session.cart.map((item) => ({
    pedido_id: pedido.id,
    descripcion: item.descripcion,
    cantidad: item.cantidad,
    categoria: item.categoria,
  }));

  const { error: errorDetalle } = await supabase
    .from("pedidos_detalle")
    .insert(detalles);

  if (errorDetalle)
    console.error("❌ Error insertando detalle:", errorDetalle);
  else console.log("🧾 Detalles guardados correctamente.");

  return pedido;
}

// ============================================================
// ===============  ENDPOINT PRINCIPAL /whatsapp ===============
// ============================================================

app.post("/whatsapp", async (req, res) => {
  console.log("===========================================");
  console.log("📥 NEW REQUEST");
  console.log("📥 HEADERS:", req.headers);
  console.log("📥 RAW BODY:", req.body);
  console.log("===========================================");

  // WhatsAuto envía application/x-www-form-urlencoded
  let phone = req.body.phone || req.body.from;
  let message = req.body.message;

  if (!phone || !message) {
    console.log("⚠️ Payload incompleto.");
    return res.json({
      reply:
        "No pude entender tu mensaje, ¿puedes escribirlo nuevamente por favor? 😊",
    });
  }

  phone = phone.trim();

  console.log("📥 BODY PROCESADO:", { phone, message });

  // Obtener sesión del cliente
  const session = getSession(phone);

  // Cargar cliente si es primera vez
  if (!session.checkedClient) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("*")
      .eq("telefono", phone)
      .maybeSingle();

    if (cliente) {
      console.log("ℹ️ Cliente conocido:", phone);
      session.knownClient = true;
      session.customer.nombre = cliente.nombre;
      session.customer.direccion = cliente.direccion;
      session.customer.telefono_alt = cliente.telefono_alt;
      session.comuna = cliente.comuna;
    } else {
      console.log("ℹ️ Cliente nuevo:", phone);
    }

    session.checkedClient = true;
  }

  // Guardar mensaje en historial
  pushHistory(session, "user", message);

  // Llamar a IA
  const ai = await askLunaAI({ session, userMessage: message });

  if (!ai) {
    console.log("⚠️ IA devolvió nulo.");
    return res.json({
      reply:
        "Tuve un problema técnico al responder. ¿Podrías escribir nuevamente? 🙏",
    });
  }

  // Aplicar cambios a la sesión
  const reply = aplicarRespuestaAI(session, ai);

  // Si se confirmó → guardar pedido
  const confirmado = ai?.data?.confirmado === true;

  if (confirmado) {
    // Guardar cliente siempre
    await upsertCliente(session);

    // Guardar pedido
    await guardarPedido(session);

    // Permitir agregar productos después de confirmar
    session.orderSaved = true;
    session.state = "finalizado";

    console.log("🎉 Pedido agendado con éxito.");

    return res.json({
      reply: reply + " ✅",
    });
  }

  // Guardar respuesta en historial
  pushHistory(session, "assistant", reply);

  // Enviar la respuesta final a WhatsAuto
  return res.json({ reply });
});

// ============================================================
// ========================= SERVIDOR ==========================
// ============================================================

app.get("/", (req, res) => {
  res.send("Luna Bot operativo ✅");
});

app.listen(PORT, () => {
  console.log(`🚀 Luna Bot escuchando en puerto ${PORT}`);
});
