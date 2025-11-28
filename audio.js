export function extraerMensaje(body) {
  if (body.transcript) return body.transcript;
  if (body.message) return body.message;
  return "";
}
