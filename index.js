// index.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
dotenv.config();

import { supabase } from "./supabase.js";
import { transcribirAudio } from "./audio.js";
import { responderConGPT } from "./gpt.js";
import {
  esNombre,
  esDireccion,
  esTelefono,
  validarComuna,
  detectarProductos,
  construirTextoResumen
} from "./helpers.js";
import { RULES } from "./rules.js";
import { CATALOGO } from "./catalogo.js";

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* ======================================================
   0. ENDPOINT PRINCIPAL PARA WHATAUTO
   Recibe: { phone, message, type, mediaUrl }
====================================================== */
app.post("/whatsapp", async (req, res) => {
  console.log("📩 Request recibido:", req.body);

  try {
    const { phone, message, type, mediaUrl } = req.body;
    const from = phone;
    let texto = message || "";

    // 0.1 Transcribir nota de voz si corresponde
    if (type === "voice" && mediaUrl) {
      console.log("🎙 Nota de voz recibida, transcribiendo…");
      const transcrito = await transcribirAudio(mediaUrl);
      texto = transcrito || "[nota de voz no entendida]";
      console.log("📝 Texto transcrito:", texto);
    }

    // 1. Buscar cliente en BD
    let { data: cliente, error: clienteError } = await supabase
      .from("clientes_detallados")
      .select("*")
      .eq("whatsapp", from)
      .single();

    if (clienteError && clienteError.code !== "PGRST116") {
      console.error("❌ Error buscando cliente:", clienteError);
    }

    let esNuevo = false;

    if (!cliente) {
      // 1.a Cliente nuevo → crear y enviar catálogo + preguntar comuna
      esNuevo = true;
      const { data: nuevoCliente, error: insertError } = await supabase
        .from("clientes_detallados")
        .insert({
          whatsapp: from,
          pedido: "[]",
          valor_total: 0,
          costo_envio: 0
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error creando cliente:", insertError);
        return res.json({
          reply:
            "Lo siento 💛 hubo un error al registrarte. Intenta nuevamente en unos minutos."
        });
      }

      cliente = nuevoCliente;

      const textoCatalogo =
        `${RULES.mensajeBienvenida}\n\n` +
        `🍰 Queques Peruanos ($${CATALOGO.quequesPeruanos.precio}) – Sabores: ${CATALOGO.quequesPeruanos.sabores.join(
          ", "
        )}. Porciones: ${CATALOGO.quequesPeruanos.porciones.join(
          ", "
        )}. Tamaño: ${CATALOGO.quequesPeruanos.tamanio}.\n\n` +
        `🍪 Galletas y Delicias en bandeja de 20 unidades ($${CATALOGO.galletasBandeja.precio}) – Productos: ${CATALOGO.galletasBandeja.productos.join(
          ", "
        )}. (Bandejas por producto, no surtidas).\n\n` +
        `🧁 Muffins:\n- ${CATALOGO.muffins.chips.nombre}: $${CATALOGO.muffins.chips.precio}\n- ${CATALOGO.muffins.premium.nombre}: $${CATALOGO.muffins.premium.precio} (${CATALOGO.muffins.premium.detalle.join(
          ", "
        )}).\n\n` +
        `🤩 Delicias Premium:\n- ${CATALOGO.deliciasPremium.alfajoresMaicena.nombre}: $${CATALOGO.deliciasPremium.alfajoresMaicena.precio}\n- ${CATALOGO.deliciasPremium.cachitosManjar.nombre}: $${CATALOGO.deliciasPremium.cachitosManjar.precio}\n\n` +
        `📦 Queque Artesanal Rectangular (${CATALOGO.quequeRectangular.tamanio}) – Sabores: ${CATALOGO.quequeRectangular.sabores.join(
          ", "
        )}. Precio: $${CATALOGO.quequeRectangular.precioUnidad}. ${CATALOGO.quequeRectangular.ofertaTexto}\n\n` +
        `Las entregas se realizan al día siguiente (excepto domingos).\n\n` +
        `¿En qué comuna vamos a despachar?`;

      return res.json({ reply: textoCatalogo });
    }

    // 2. Cargar pedido actual (JSON en texto)
    let pedidoItems = [];
    if (cliente.pedido) {
      try {
        const parsed = JSON.parse(cliente.pedido);
        if (Array.isArray(parsed)) pedidoItems = parsed;
      } catch {
        pedidoItems = [];
      }
    }

    const textoLower = texto.toLowerCase();

    // 3. Confirmación final
    if (
      ["confirmo", "sí confirmo", "si confirmo", "acepto", "confirmado"].some(
        (w) => textoLower.includes(w)
      ) &&
      pedidoItems.length > 0
    ) {
      // Construir resumen para guardar
      const resumen = construirTextoResumen(pedidoItems, cliente.comuna);
      const { total, envio } = resumen;

      const { error: insertPedidoError } = await supabase
        .from("pedidos_completos")
        .insert({
          whatsapp: from,
          nombre: cliente.nombre || null,
          comuna: cliente.comuna || null,
          direccion: cliente.direccion || null,
          telefono_adicional: cliente.telefono_adicional || null,
          pedido: JSON.stringify(pedidoItems),
          valor_total: total,
          costo_envio: envio,
          fecha_entrega: null, // podría definirse en otra capa si usas fechas reales
          hora_estimada: null,
          confirmado: true
        });

      if (insertPedidoError) {
        console.error("❌ Error guardando pedido:", insertPedidoError);
        return res.json({
          reply:
            "Tu pedido casi queda listo, pero hubo un problema al guardar 💛. Por favor intenta nuevamente o escríbenos."
        });
      }

      // Actualizar cliente con totales
      await supabase
        .from("clientes_detallados")
        .update({
          pedido: JSON.stringify(pedidoItems),
          valor_total: total,
          costo_envio: envio
        })
        .eq("whatsapp", from);

      return res.json({
        reply: "¡Perfecto! Tu pedido quedó agendado 💛\n\n✔️"
      });
    }

    // 4. Si aún no tiene comuna → intentar tomar comuna
    if (!cliente.comuna) {
      const val = validarComuna(texto);
      if (val.reparto) {
        await supabase
          .from("clientes_detallados")
          .update({ comuna: texto })
          .eq("whatsapp", from);

        return res.json({
          reply:
            "Perfecto 💛 tenemos reparto en tu comuna. Cuéntame, ¿qué te gustaría pedir?"
        });
      }

      // No hay reparto → ofrecer retiro en domicilio y pasar a flujo de productos (omitir paso 3 de despacho)
      return res.json({
        reply:
          "Por ahora no tenemos reparto directo a esa comuna 💛.\n" +
          `Puedes retirar en nuestro domicilio: ${RULES.retiroDomicilio}\n\n` +
          "Si te sirve el retiro, cuéntame qué te gustaría pedir."
      });
    }

    // 5. Si ya hay comuna, detectar productos en el mensaje
    const detectados = detectarProductos(texto);
    if (detectados.length > 0) {
      const nuevoPedido = [...pedidoItems, ...detectados];

      await supabase
        .from("clientes_detallados")
        .update({
          pedido: JSON.stringify(nuevoPedido)
        })
        .eq("whatsapp", from);

      return res.json({
        reply:
          "Anoté tu pedido 💛\n" +
          detectados
            .map((p) => `- ${p.cantidad} x ${p.nombre}`)
            .join("\n") +
          "\n\nSi quieres agregar algo más, dime. Cuando estés listo, puedes pedir *el resumen de tu pedido*."
      });
    }

    // 6. Paso 3: Datos de despacho (solo si hay pedido y la comuna sí tiene reparto)
    const comunaValida = validarComuna(cliente.comuna).reparto;

    if (pedidoItems.length > 0 && comunaValida) {
      // 6.1 Falta nombre
      if (!cliente.nombre) {
        if (esNombre(texto)) {
          await supabase
            .from("clientes_detallados")
            .update({ nombre: texto })
            .eq("whatsapp", from);

          return res.json({
            reply: "Gracias 💛 Ahora indícame tu dirección completa."
          });
        }

        return res.json({
          reply:
            "Para el despacho necesito tu *nombre y apellido* 💛. Escríbemelos en un solo mensaje."
        });
      }

      // 6.2 Falta dirección
      if (!cliente.direccion) {
        if (esDireccion(texto)) {
          await supabase
            .from("clientes_detallados")
            .update({ direccion: texto })
            .eq("whatsapp", from);

          return res.json({
            reply:
              "Perfecto 💛 ¿Tienes un teléfono adicional o uso este mismo de WhatsApp?"
          });
        }

        return res.json({
          reply:
            "Indícame tu *dirección completa* para el despacho (calle, número, depto/casa) 💛."
        });
      }

      // 6.3 Falta teléfono adicional
      if (!cliente.telefono_adicional) {
        if (esTelefono(texto)) {
          await supabase
            .from("clientes_detallados")
            .update({ telefono_adicional: texto })
            .eq("whatsapp", from);

          return res.json({
            reply:
              "Gracias 💛 Ya tengo tus datos. Si quieres, dime *resumen* para ver el detalle de tu pedido."
          });
        }

        // Si dice que no tiene otro teléfono → usar el mismo
        if (textoLower.includes("no") && textoLower.includes("otro")) {
          await supabase
            .from("clientes_detallados")
            .update({ telefono_adicional: from })
            .eq("whatsapp", from);

          return res.json({
            reply:
              "Sin problema 💛 usaré este mismo número. Cuando quieras, pide *el resumen de tu pedido*."
          });
        }

        return res.json({
          reply:
            "¿Tienes un *teléfono adicional* para contacto? Si no, puedes decirme que use este mismo 💛."
        });
      }
    }

    // 7. Paso 4: Resumen (cuando el cliente lo pida)
    if (
      pedidoItems.length > 0 &&
      (textoLower.includes("resumen") ||
        textoLower.includes("mi pedido") ||
        textoLower.includes("detalle"))
    ) {
      const resumen = construirTextoResumen(pedidoItems, cliente.comuna);
      return res.json({ reply: resumen.texto });
    }

    // 8. GPT general: responder dudas en cualquier momento y seguir flujo de venta
    const { data: historial } = await supabase
      .from("historial")
      .select("*")
      .eq("whatsapp", from);

    const respuesta = await responderConGPT(texto, cliente, historial || []);

    await supabase.from("historial").insert({
      whatsapp: from,
      mensaje_cliente: texto,
      respuesta_luna: respuesta
    });

    return res.json({ reply: respuesta });
  } catch (e) {
    console.error("❌ Error general en /whatsapp:", e);
    return res.json({
      reply: "Ocurrió un error inesperado 💛 Por favor intenta nuevamente."
    });
  }
});

/* SERVIDOR */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Luna Bot listo en puerto ${PORT}`);
});
