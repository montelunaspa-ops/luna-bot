const OpenAI = require("openai");
const rules = require("./rules");

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

module.exports = async function askLuna(userMessage, state) {

    const prompt = `
Eres Luna, asistente virtual de Delicias Monte Luna.

REGLAS:
${rules.reglas_globales}

CATÁLOGO:
${rules.catalogo}

COMUNAS DE DESPACHO:
${rules.comunas_despacho.join("\n")}

HORARIOS:
${JSON.stringify(rules.horarios, null, 2)}

DATOS ADICIONALES:
${rules.despacho_info}
${rules.compra_minima}
${rules.ubicacion}

ESTADO ACTUAL DEL CLIENTE:
${JSON.stringify(state)}

MENSAJE DEL CLIENTE:
${userMessage}

RESPONDE SOLO TEXTO, NO USAR EMOJIS EXCEPTO EN RESÚMENES FINALES.
    `;

    const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150
    });

    return completion.choices[0].message.content;
}
