// /middleware/rulesMiddleware.js
import { getRules } from "../utils/rulesLoader.js";

export async function applyRulesToMessage(userMessage) {
  const rules = await getRules();

  return `
Eres Luna, asistente virtual de Delicias Monte Luna.
Debes seguir estrictamente las siguientes reglas actualizadas:

${rules}

Mensaje del cliente:
${userMessage}
`;
}

