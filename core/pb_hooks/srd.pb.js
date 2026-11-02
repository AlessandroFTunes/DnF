/// <reference path="../pb_data/types.d.ts" />

// Repassa /srd/* para a 5e-FastAPI com o service token do Cloudflare Access, que fica só no servidor
// (DND_API_ACCESS_ID / DND_API_ACCESS_SECRET). Só para jogadores logados.
// DND_API_URL troca o destino: no NAS é http://5e-fastapi:8000 (mesma rede Docker, sem Cloudflare nem token).
// CACHE_URL (Webdis, a ponte HTTP do Redis) guarda as respostas por 1 dia para todos os jogadores. Sem ele, ou
// se o Redis cair, repassa direto.
// Só repassa os caminhos da API de regras ("api/v1/<recurso>/<id>…", letras minúsculas, números, "_" e "-"): o service
// token não pode servir para chamar qualquer outra rota da API nem montar caminhos com "..".
routerAdd(
  "GET",
  "/srd/{path...}",
  (e) => {
    const route = e.request.pathValue("path");
    if (!/^api\/v1\/[a-z0-9_-]+(\/[a-z0-9_-]+)*$/.test(route)) return e.json(404, { message: "Rota não encontrada." });
    const query = e.request.url.rawQuery;
    const path = route + (query ? "?" + query : "");
    const cache = $os.getenv("CACHE_URL");
    const key = cache && cache + "/{cmd}/srd:" + $security.sha256(path);

    if (cache) {
      try {
        const hit = $http.send({ url: key.replace("{cmd}", "GET"), timeout: 1 }).json.GET;
        if (hit) return e.blob(200, "application/json", hit);
      } catch (err) {
        e.app.logger().warn("srd: cache fora", "error", String(err));
      }
    }

    const res = $http.send({
      url: ($os.getenv("DND_API_URL") || "https://5e-fastapi.developale.com") + "/" + path,
      headers: {
        "CF-Access-Client-Id": $os.getenv("DND_API_ACCESS_ID"),
        "CF-Access-Client-Secret": $os.getenv("DND_API_ACCESS_SECRET"),
      },
      timeout: 30,
    });

    if (cache && res.statusCode === 200) {
      try {
        $http.send({ method: "PUT", url: key.replace("{cmd}", "SETEX") + "/86400", body: toString(res.body), timeout: 1 });
      } catch (err) {
        e.app.logger().warn("srd: não deu para guardar no cache", "error", String(err));
      }
    }
    return e.json(res.statusCode, res.json);
  },
  $apis.requireAuth(),
);
