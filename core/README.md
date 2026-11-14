# core

Regras de negócio, API e banco de dados do DnF (Hono + Drizzle + Postgres).

- `src/<módulo>/` — um módulo por pasta (`@dnf/core/<módulo>`): schemas, regras de D&D e as chamadas do app à API.
  Tabelas do banco ficam ao lado, em `<módulo>.sql.ts`
- `src/api/` — as rotas HTTP e as regras de acesso (só o servidor importa)
- `src/http/` — o cliente da API que o app e o DM-Control usam
- `drizzle/` — migrations (geradas com `bun run db:generate`; rodam sozinhas ao subir a API)
- `server.ts` — entrada da API (`bun run api`)
- `deploy/` — modelo do compose do NAS
- `piper-http/` — ponte HTTP do Piper (voz de reserva do Grande Sábio)

Rodar local: `docker compose up -d --wait api` na raiz. Detalhes e variáveis no `CLAUDE.md` da raiz.
