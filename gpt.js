import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function responderGPT({ mensajeOriginal, mensajeNormalizado, reglas, historial, cliente }) {

  const historialTexto = historial
    .map(h => `Cliente: ${h.mensaje_usuario}\nLuna: ${h.respuesta_bot}`)
    .join("\n");

  const prompt = `
Eres Luna, asistente virtual de ${reglas.nombre_negocio}.
Toda tu información proviene EXCLUSIVAMENTE de esta base de datos.

== INFORMACIÓN DISPONIBLE ==
Catálogo:
${reglas.catalogo}

Comunas con despacho:
${reglas.comunas_despacho}

Horarios por comuna:
${reglas.horarios_comuna}

Reglas:
${reglas.reglas_negocio}

Flujo paso 1–5:
${reglas.flujo_1}
${reglas.flujo_2}
${reglas.flujo_3}
${reglas.flujo_4}
${reglas.flujo_5}

Regla global:
${reglas.regla_global}

==== HISTORIAL ====
${historialTexto}

==== MENSAJE DEL CLIENTE ====
${mensajeOriginal}

==== INSTRUCCIONES ====
- Responde SIEMPRE en mensaje corto y claro.
- Si el cliente hace preguntas fuera del flujo, respóndelas y vuelve a guiar.
- No preguntes por la comuna si ya se preguntó muchas veces sin respuesta.
- Si menciona un audio como “🎤 mensaje de voz”, pídele que lo escriba.
- NUNCA repitas siempre la misma pregunta.
- Mantén conversación natural: responde lo que pregunte.
- Luego continúa el flujo según lo que falta.

Ahora responde como Luna:
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: mensajeOriginal }
    ]
  });

  return completion.choices[0].message.content.trim();
}
