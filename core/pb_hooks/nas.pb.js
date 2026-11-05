/// <reference path="../pb_data/types.d.ts" />

// Entrega ao app a capa das mesas guardada no NAS (a mesma pasta que o DM-Control grava e serve em /nas/<caminho>).
// O caminho é "<id da mesa>/imagens/<arquivo>" (capa) ou "<id da mesa>/mapas/<arquivo>". Mesmas regras do DM-Control
// (core/src/storage/nas.ts, `Nas.reader`): o mestre lê tudo da mesa dele; o jogador só a pasta "imagens" das mesas em
// que participa. Sem direito, 404 igual a "não existe", para não revelar quais arquivos há.
// NAS_DIR é a pasta do NAS dentro do container (padrão /nas, montada somente leitura).
// `require` e variáveis de fora não existem dentro dos handlers (cada um roda isolado), por isso os valores se repetem.
routerAdd(
  "GET",
  "/nas/{path...}",
  (e) => {
    const notFound = () => e.json(404, { message: "Arquivo não encontrado." });
    const url = e.request.pathValue("path");
    const parts = url.split("/");
    // Só letras, números, "." "_" e "-": nada de ".." nem caminho absoluto.
    if (url.length > 255 || !parts.every((p) => /^[\w][\w.-]*$/.test(p) && p !== "." && p !== "..")) return notFound();

    const mesaID = parts[0];
    const folder = parts[1];
    if (parts.length < 3 || (folder !== "imagens" && folder !== "mapas")) return notFound();

    const types = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      avif: "image/avif",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      pdf: "application/pdf",
    };
    const type = types[url.split(".").pop().toLowerCase()];
    if (!type) return notFound();

    let allowed = false;
    try {
      const mesa = e.app.findRecordById("mesas", mesaID);
      allowed = mesa.getString("gm") === e.auth.id;
      if (!allowed && folder === "imagens") {
        e.app.findFirstRecordByFilter("mesa_members", "mesa = {:mesa} && user = {:user}", { mesa: mesaID, user: e.auth.id });
        allowed = true;
      }
    } catch (err) {
      allowed = false;
    }
    if (!allowed) return notFound();

    let bytes;
    try {
      bytes = $os.readFile(($os.getenv("NAS_DIR") || "/nas") + "/" + url);
    } catch (err) {
      return notFound();
    }
    e.response.header().set("Cache-Control", "private, max-age=86400");
    e.response.header().set("X-Content-Type-Options", "nosniff");
    return e.blob(200, type, bytes);
  },
  $apis.requireAuth(),
);
