diff --git a/index.js b/index.js
index 3388664dd5bbd709f08da8f8dda06a1789e6747b..4c93fba375b802debd147066e217fea1f1838499 100644
--- a/index.js
+++ b/index.js
@@ -1,93 +1,107 @@
 // ============================================================================
 // LUNA BOT - DELICIAS MONTE LUNA
 // ARCHIVO: index.js
 // BLOQUE 1 / 3
 // ============================================================================
 
 // DEPENDENCIAS BÁSICAS
 import express from "express";
 import bodyParser from "body-parser";
 import dotenv from "dotenv";
 import OpenAI from "openai";
 import { createClient } from "@supabase/supabase-js";
 
 dotenv.config();
 
 // CONFIGURACIÓN BASE
 const app = express();
 const PORT = process.env.PORT || 3000;
 
 // Permite recibir JSON y x-www-form-urlencoded (WhatsAuto lo requiere)
 app.use(bodyParser.json({ limit: "5mb" }));
 app.use(bodyParser.urlencoded({ extended: true }));
 
 // OpenAI
+const openaiApiKey = process.env.OPENAI_API_KEY;
+if (!openaiApiKey) {
+  console.error("❌ Falta OPENAI_API_KEY en .env. No se puede iniciar el bot.");
+  process.exit(1);
+}
 const openai = new OpenAI({
-  apiKey: process.env.OPENAI_API_KEY,
+  apiKey: openaiApiKey,
 });
 
 // Supabase
 const supabaseUrl = process.env.SUPABASE_URL;
 const supabaseKey = process.env.SUPABASE_KEY;
 if (!supabaseUrl || !supabaseKey) {
-  console.error("❌ Faltan SUPABASE_URL o SUPABASE_KEY en .env");
+  console.error("❌ Faltan SUPABASE_URL o SUPABASE_KEY en .env. No se puede iniciar el bot.");
+  process.exit(1);
 }
 const supabase = createClient(supabaseUrl, supabaseKey);
 
 // SESIONES EN MEMORIA
 const sessions = {};
+const VALID_STATES = new Set([
+  "inicio",
+  "preguntar_comuna",
+  "productos",
+  "datos_cliente",
+  "confirmacion",
+  "finalizado",
+]);
 
 function getSession(phone) {
   if (!sessions[phone]) {
     sessions[phone] = {
       phone,
       knownClient: false,
       checkedClient: false,
       comuna: null,
       cart: [],
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
       history: [],
     };
   }
   return sessions[phone];
 }
 
 function pushHistory(session, role, content) {
   session.history.push({ role, content });
-  if (session.history.length > 10) {
-    session.history = session.history.slice(-10);
+  if (session.history.length > 12) {
+    session.history = session.history.slice(-12);
   }
 }
 
 // ============================================================================
 // CATÁLOGO (FORMATO TABULADO Y LIMPIO)
 // ============================================================================
 
 const RULES_TEXT = `
 ¡Hola! Soy Luna, asistente virtual de Delicias Monte Luna. 🌙✨
 Puedes hacer tu pedido fácilmente por la página www.monteluna.cl o por WhatsApp.
 
 Catálogo:
 
 🍰 Queques Peruanos
     • Sabores:
         - Chocolate
         - Marmoleado
         - Piña
         - Vainilla
         - Naranja
         - Maracuyá
     • Porciones:
         - 14
         - 16
         - Sin cortar
@@ -274,185 +288,195 @@ function normalizarProductos(lista) {
     .filter(Boolean);
 }
 
 // Merge compacto estilo supermercado
 function mergeProductos(lista) {
   const out = [];
 
   for (const p of lista) {
     const match = out.find(
       (x) =>
         x.producto?.toLowerCase() === p.producto?.toLowerCase() &&
         (x.sabor || "").toLowerCase() === (p.sabor || "").toLowerCase() &&
         (x.porcion || "").toLowerCase() === (p.porcion || "").toLowerCase()
     );
 
     if (match) {
       match.cantidad += p.cantidad;
     } else {
       out.push({ ...p });
     }
   }
 
   return out;
 }
 
+// ============================================================================
 // Convertir carrito a formato IA esperado
 function prepararCarritoParaIA(cart) {
   return cart.map((p) => ({
     descripcion: `${p.producto}${p.sabor ? " " + p.sabor : ""}${
       p.porcion ? " (" + p.porcion + ")" : ""
     }`,
     cantidad: p.cantidad,
     categoria: "producto",
   }));
 }
 
 // ============================================================================
 // FUNCIÓN askLunaAI()
 // ============================================================================
 
 async function askLunaAI({ session, userMessage }) {
   console.log("🧠 [IA] Generando respuesta para:", userMessage);
 
   const contextoJSON = {
     estado: session.state,
     telefono: session.phone,
     cliente_conocido: session.knownClient ? "sí" : "no",
     comuna_actual: session.comuna,
     carrito: session.cart,
     datos_cliente: session.customer,
     entrega: session.delivery,
   };
 
   const systemMessage = `
 Eres LUNA, asistente virtual de Delicias Monte Luna.
 
 SIGUES ESTAS REGLAS:
 ${FLOW_RULES_TEXT}
 
 CATÁLOGO COMPLETO:
 ${RULES_TEXT}
 
-INSTRUCCIONES:
-- Siempre respondes SOLO en JSON.
-- "reply" debe contener 1–2 frases amables.
+INSTRUCCIONES ESTRICTAS DE RESPUESTA:
+- Responde SOLO en JSON válido y nada más.
+- "reply" debe contener 1–2 frases amables, claras y en español neutro.
 - Si el cliente dice un producto sin cantidad → PREGUNTA cantidad.
 - Si dice un producto sin sabor → PREGUNTA sabor.
 - Si dice un producto sin porción → PREGUNTA porción.
-- Si el producto NO existe → informa y muestra opciones correctas.
-- Si el cliente agrega productos en cualquier momento → acéptalos.
-- Si el cliente ya confirmó y agrega algo → vuelve a pedir confirmación.
-- Resumen estilo supermercado.
+- Si el producto NO existe → informa y muestra opciones correctas del catálogo.
+- Si el cliente agrega productos en cualquier momento → acéptalos y actualiza el resumen.
+- Si el cliente ya confirmó y agrega algo → vuelve a pedir confirmación tras actualizar.
+- Resumen estilo supermercado con cantidad x producto.
 - ESTADOS válidos: inicio, preguntar_comuna, productos, datos_cliente, confirmacion, finalizado.
+- Si falta información mínima (comuna, sabor, porción, cantidad o datos cliente) debes pedirla antes de marcar pedido_completo.
+- Siempre devuelve fecha_entrega y horario_entrega propuestos.
 
-EL JSON DE RESPUESTA DEBE SER:
+EL JSON DE RESPUESTA DEBE SER EXACTAMENTE:
 {
   "reply": "...",
   "state": "...",
   "data": {
     "comuna": "...",
     "productos": [...],
     "datos_cliente": {...},
     "pedido_completo": true|false,
     "confirmado": true|false,
     "horario_entrega": "...",
     "fecha_entrega": "YYYY-MM-DD"
   }
 }`;
 
   const messages = [
     { role: "system", content: systemMessage },
     ...session.history.map((m) => ({
       role: m.role,
       content: m.content,
     })),
     {
       role: "user",
       content:
         `Mensaje del cliente: "${userMessage}"\n\nContexto actual:\n` +
         JSON.stringify(contextoJSON),
     },
   ];
 
   const completion = await openai.chat.completions.create({
     model: "gpt-4o-mini",
     messages,
     temperature: 0.15,
+    max_tokens: 600,
+    response_format: { type: "json_object" },
   });
 
   const raw = completion.choices[0]?.message?.content || "";
   console.log("🤖 [IA RAW]:", raw);
 
   return raw;
 }
 
 // ============================================================================
 // PROCESADOR DE RESPUESTA IA → ACTUALIZA LA SESIÓN
 // ============================================================================
 
 async function procesarRespuestaIA(session, ai) {
   console.log("🧩 Procesando JSON IA…");
 
-  // Estado
-  if (ai.state) session.state = ai.state;
+  // Estado (validado)
+  if (ai.state && VALID_STATES.has(ai.state)) {
+    session.state = ai.state;
+  }
 
   // Comuna
   if (ai.data?.comuna) session.comuna = ai.data.comuna;
 
   // Productos (merge avanzado)
   if (Array.isArray(ai.data?.productos)) {
-    const normal = normalizarProductos(ai.data.productos);
+    const normal = normalizarProductos(ai.data.productos).map((p) => ({
+      ...p,
+      cantidad: Math.max(1, Number.isFinite(p.cantidad) ? p.cantidad : 1),
+    }));
     const merged = mergeProductos(normal);
     session.cart = merged;
     console.log("🛒 Carrito actualizado:", merged);
   }
 
   // Datos cliente
   if (ai.data?.datos_cliente) {
     session.customer = {
       ...session.customer,
       ...ai.data.datos_cliente,
     };
     console.log("👤 Datos cliente:", session.customer);
   }
 
   // Fecha entrega
   if (ai.data?.fecha_entrega) {
     session.delivery.fecha_entrega = ai.data.fecha_entrega;
   } else {
     session.delivery.fecha_entrega = calcularFechaEntregaCorregida();
   }
 
   // Horario entrega
   if (ai.data?.horario_entrega) {
     session.delivery.horario_aprox = ai.data.horario_entrega;
   }
 
   return {
-    pedido_completo: !!ai.data?.pedido_completo,
-    confirmado: !!ai.data?.confirmado,
+    pedido_completo: Boolean(ai.data?.pedido_completo),
+    confirmado: Boolean(ai.data?.confirmado),
   };
 }
 // ============================================================================
 // BLOQUE 3 / 3 — Guardado Supabase + Webhook WhatsAuto + Servidor
 // ============================================================================
 
 // Guardar cliente
 async function upsertClienteFromSession(session) {
   console.log("💾 Guardando cliente…");
 
   const { phone, customer, comuna } = session;
 
   const { error } = await supabase.from("clientes").upsert(
     {
       telefono: phone,
       nombre: customer.nombre || null,
       direccion: customer.direccion || null,
       comuna: comuna || null,
       telefono_alt: customer.telefono_alt || null,
     },
     { onConflict: "telefono" }
   );
 
   if (error) console.error("❌ Error guardando cliente:", error);
   else console.log("✅ Cliente guardado:", phone);
@@ -476,115 +500,121 @@ async function guardarPedidoCompleto(session) {
     })
     .select()
     .single();
 
   if (error) {
     console.error("❌ Error insertando pedido:", error);
     return;
   }
 
   console.log("🧾 Pedido creado:", pedido.id);
 
   // Guardar detalle
   const detalles = session.cart.map((p) => ({
     pedido_id: pedido.id,
     descripcion: `${p.producto} ${p.sabor || ""} ${p.porcion ? "(" + p.porcion + ")" : ""}`,
     cantidad: p.cantidad,
     categoria: "producto",
   }));
 
   const { error: err2 } = await supabase.from("pedidos_detalle").insert(detalles);
 
   if (err2) console.error("❌ Error detalle:", err2);
   else console.log("📦 Detalle guardado");
 }
 
-// ============================================================================
-// WEBHOOK WHATAUTO
-// ============================================================================
-
-app.post("/whatsapp", async (req, res) => {
-  console.log("📥 BODY:", req.body);
-
-  const { phone, message } = req.body || {};
-  if (!phone || !message) {
-    return res.json({
-      reply: "No pude leer tu mensaje. ¿Puedes enviarlo nuevamente? 😊",
-    });
-  }
-
+async function handleIncomingMessage(phone, message) {
   const session = getSession(phone);
 
-  // Buscar cliente la primera vez
   if (!session.checkedClient) {
     const { data } = await supabase
       .from("clientes")
       .select("*")
       .eq("telefono", phone)
       .maybeSingle();
 
     if (data) {
       session.knownClient = true;
       session.customer.nombre = data.nombre;
       session.customer.direccion = data.direccion;
       session.customer.telefono_alt = data.telefono_alt;
       session.comuna = data.comuna;
       console.log("🟢 Cliente conocido:", phone);
     } else {
       console.log("🟡 Cliente nuevo:", phone);
     }
 
     session.checkedClient = true;
   }
 
-  // Guardar historial
   pushHistory(session, "user", message);
 
-  // IA
   let aiRaw;
   try {
     aiRaw = await askLunaAI({ session, userMessage: message });
   } catch (err) {
     console.error("❌ Error IA:", err);
-    return res.json({ reply: "Error temporal, intenta nuevamente 🙏" });
+    return { reply: "Error temporal, intenta nuevamente 🙏" };
   }
 
   let ai;
   try {
     ai = JSON.parse(aiRaw);
   } catch (err) {
     console.error("⚠ JSON inválido de IA.");
-    return res.json({
+    return {
       reply: "No entendí tu mensaje, ¿podrías repetirlo? 😊",
-    });
+    };
+  }
+
+  if (!ai.reply || !ai.data) {
+    console.error("⚠ Respuesta IA incompleta.");
+    return { reply: "Estoy ajustando mi respuesta, ¿podrías repetirlo? 😊" };
   }
 
   const reply = ai.reply || "Estoy procesando tu pedido…";
 
-  // Actualizar sesión
   const resultado = await procesarRespuestaIA(session, ai);
 
-  // Si confirmó
   if (resultado.confirmado && !session.orderSaved) {
     await upsertClienteFromSession(session);
     await guardarPedidoCompleto(session);
 
     session.orderSaved = true;
     session.state = "finalizado";
   }
 
   pushHistory(session, "assistant", reply);
 
+  return { reply };
+}
+
+// ============================================================================
+// WEBHOOK WHATAUTO
+// ============================================================================
+
+app.post("/whatsapp", async (req, res) => {
+  console.log("📥 BODY:", req.body);
+
+  const { phone, message } = req.body || {};
+  if (!phone || !message) {
+    return res.json({
+      reply: "No pude leer tu mensaje. ¿Puedes enviarlo nuevamente? 😊",
+    });
+  }
+
+  const { reply } = await handleIncomingMessage(phone, message);
+
   return res.json({ reply });
 });
 
 // ============================================================================
 // SERVIDOR
 // ============================================================================
 
 app.get("/", (req, res) => {
   res.send("Luna Bot funcionando correctamente ✅");
 });
 
 app.listen(PORT, () => {
   console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
 });
