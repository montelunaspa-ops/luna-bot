import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();
import rules from "./rules.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function clasificarMensaje(texto) {
  try {
    const prompt = `
Analiza el mensaje y determina claramente su categoría.

CATEGORÍAS POSIBLES:
1) "comuna_valida"
2) "comuna_invalida"
3) "pregunta"
4) "otro"

COMUNAS VÁLIDAS:
${rules.comunas.join(", ")}

INSTRUCCIONES:
- Si el mensaje contiene una comuna válida en cualquier parte de la frase, clasifícalo como "comuna_valida".
  Ejemplos:
  "mejor en cerro navia"
  "estoy en quinta normal"
  "sería en recoleta"
  "puede ser maipú"

- Si menciona una comuna que existe en Chile pero no está en la lista, clasifícalo como "comuna_invalida".
  Ejemplo:
  "soy de quilicura"

- Si contiene palabras como dónde, cuánto, cómo, por qué, qué hora, cuando, o tiene forma de pregunta: clasifica como "pregunta".

- Si NO es comuna ni pregunta, clasifica como "otro".

MENSAJE:
"${texto}"

RESPUESTA:
Devuelve SOLO la categoría SIN explicación.
`;

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    });

    return r.choices[0].message.content.trim();
  } catch (e) {
    console.log("❌ Error clasificando mensaje:", e);
    return "otro";
  }
}
