// gpt.js — Motor de flujo conversacional controlado por JSON
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

import rules from "./rules.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function systemPrompt(cliente) {
  return `
Eres Luna 💛, asistente virtual de Delicias Monte Luna.

Reglas ABSOLUTAS:
- SOLO debes usar la información oficial (catálogo, precios, comunas, horarios, reglas).
- NO puedes inventar nada.
- Si algo no existe: responde "Lo siento 💛, esa información no está disponible."

Tu misión es dirigir el FLUJO COMPLETO del pedido usando ESTADO:

Estados posibles:
- esperando_comuna
- esperando_retiro
- pidiendo_producto
- pidiendo_detalles_producto
- pidiendo_datos_despacho
- mostrando_resumen
- esperando_confirmacion
- finalizado

Datos del cliente:
${JSON.stringify(cliente)}

INFORMACION OFICIAL:
CATALOGO:
${rules.catalogo_completo}

COMUNAS:
${rules.comunas.join(", ")}

HORARIOS:
${JSON.stringify(rules.horarios)}

METODOS DE PAGO:
${rules.metodos_pago}

RESPONDE SIEMPRE EN ESTE FORMATO JSON:

{
  "respuesta": "mensaje para el cliente",
  "estado": "nuevo estado",
  "actualizar": { ...campos del cliente a guardar },
  "accion": "ninguna | guardar_pedido | mostrar_catalogo"
}
`;
}

export async function procesarFlujo(texto, cliente) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt(cliente) },
        { role: "user", content: texto }
      ]
    });

    const textoJSON = completion.choices[0].message.content;

    return JSON.parse(textoJSON);
  } catch (e) {
    console.log("❌ Error GPT:", e);
    return {
      respuesta: "Hubo un problema 💛 intenta de nuevo.",
      estado: cliente.estado,
      actualizar: {},
      accion: "ninguna"
    };
  }
}
