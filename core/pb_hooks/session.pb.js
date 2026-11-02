/// <reference path="../pb_data/types.d.ts" />

// Sessão da versão web do app em cookie httpOnly, para o token não ficar ao alcance de scripts (XSS).
// O app nativo não usa nada disto: continua mandando o token no Authorization (guardado no Keychain/Keystore).
//
// Como funciona (só para clientes que mandam `X-DNF-Cookie: 1`, ou seja, o app web na mesma origem do proxy):
//  1. No login e na renovação (`onRecordAuthRequest`), o token vai num cookie `dnf_session` (HttpOnly, SameSite=Strict,
//     Secure em HTTPS) e a resposta devolve no lugar dele um token "de mentira", sem assinatura, só com o `exp` e os ids.
//     O SDK do PocketBase precisa de um token com `exp` para saber que a sessão está viva; o servidor o ignora.
//  2. Em toda requisição, um middleware (antes do que lê o Authorization) troca o Authorization pelo token do cookie.
//  3. `POST /api/dnf/logout` apaga o cookie (o JavaScript não consegue, porque o cookie é HttpOnly).
// O SameSite=Strict, junto com a mesma origem, também barra CSRF: outro site não consegue enviar o cookie.
// `require` e variáveis de fora não existem dentro dos handlers (cada um roda isolado), por isso os valores se repetem.

routerUse(
  new Middleware((e) => {
    const match = (e.request.header.get("Cookie") || "").match(/(?:^|;\s*)dnf_session=([^;]+)/);
    if (match) e.request.header.set("Authorization", match[1]);
    return e.next();
  }, -2000),
);

// Neste evento o request/response ficam em `e.requestEvent`, e os cabeçalhos em `e.requestInfo().headers` (chaves em
// minúsculas, com "_" no lugar de "-").
onRecordAuthRequest((e) => {
  const headers = e.requestInfo().headers;
  if (headers["x_dnf_cookie"] !== "1") return e.next();

  const real = e.token;
  const payload = $security.parseUnverifiedJWT(real);
  const maxAge = Math.max(0, Math.floor(payload.exp - Date.now() / 1000));
  const https = headers["x_forwarded_proto"] === "https" || e.isTLS();
  e.requestEvent.response
    .header()
    .add("Set-Cookie", "dnf_session=" + real + "; Path=/; Max-Age=" + maxAge + "; HttpOnly; SameSite=Strict" + (https ? "; Secure" : ""));

  // Token "de mentira": cabeçalho e assinatura sem valor, só o que o SDK lê (exp) e os ids da conta.
  // base64url na unha: o JSVM do PocketBase não traz btoa nem Buffer (o JSON aqui é só ASCII).
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const b64 = (obj) => {
    const text = JSON.stringify(obj);
    let out = "";
    for (let i = 0; i < text.length; i += 3) {
      const n = (text.charCodeAt(i) << 16) | ((text.charCodeAt(i + 1) || 0) << 8) | (text.charCodeAt(i + 2) || 0);
      out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63];
      if (i + 1 < text.length) out += alphabet[(n >> 6) & 63];
      if (i + 2 < text.length) out += alphabet[n & 63];
    }
    return out;
  };
  e.token = b64({ alg: "none", typ: "JWT" }) + "." + b64({ id: payload.id, collectionId: payload.collectionId, type: "auth", exp: payload.exp, cookie: true }) + ".cookie";
  return e.next();
}, "users");

routerAdd("POST", "/api/dnf/logout", (e) => {
  e.response.header().add("Set-Cookie", "dnf_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict");
  return e.json(200, { ok: true });
});
