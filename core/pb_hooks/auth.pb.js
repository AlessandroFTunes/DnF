/// <reference path="../pb_data/types.d.ts" />

// Diz se já existe conta com o email, para o app decidir entre "Entrar" e "Criar conta" na primeira etapa
// (apps/mobile/src/app/login), e devolve o primeiro nome para o "Bem-vindo de volta".
// A resposta é montada campo a campo: nunca devolva o record (id, email, hash de senha, tokenKey…).
// Aberta sem login, de propósito: revela se um email está cadastrado, então conte com o rate limit do
// PocketBase (Settings > Rate limiting) para segurar varredura de emails.
routerAdd("POST", "/api/dnf/email-exists", (e) => {
  const body = e.requestInfo().body;
  const email = String(body.email || "").trim().toLowerCase();
  if (!email || email.indexOf("@") < 1) throw new BadRequestError("Email inválido.");
  let record;
  try {
    record = $app.findAuthRecordByEmail("users", email);
  } catch (_) {
    return e.json(200, { exists: false });
  }
  const firstName = record.getString("name").trim().split(/\s+/)[0] || null;
  return e.json(200, { exists: true, firstName: firstName });
});
