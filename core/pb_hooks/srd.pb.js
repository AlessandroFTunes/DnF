/// <reference path="../pb_data/types.d.ts" />

// Repassa /srd/* para a 5e-FastAPI com o service token do Cloudflare Access, que fica só no servidor
// (DND_API_ACCESS_ID / DND_API_ACCESS_SECRET). Só para jogadores logados.
// DND_API_URL troca o destino: no NAS é http://5e-fastapi:8000 (mesma rede Docker, sem Cloudflare nem token).
routerAdd(
  "GET",
  "/srd/{path...}",
  (e) => {
    const query = e.request.url.rawQuery;
    const res = $http.send({
      url: ($os.getenv("DND_API_URL") || "https://5e-fastapi.developale.com") + "/" + e.request.pathValue("path") + (query ? "?" + query : ""),
      headers: {
        "CF-Access-Client-Id": $os.getenv("DND_API_ACCESS_ID"),
        "CF-Access-Client-Secret": $os.getenv("DND_API_ACCESS_SECRET"),
      },
      timeout: 30,
    });
    return e.json(res.statusCode, res.json);
  },
  $apis.requireAuth(),
);
