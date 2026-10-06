# CLAUDE.md

## API de regras (5e-FastAPI)

As regras de D&D (classes, espécies, antecedentes, talentos, magias, equipamento) vêm da
[5e-FastAPI](https://github.com/AlessandroFTunes/5e-FastAPI), em `https://5e-fastapi.developale.com`, atrás do
Cloudflare Access (service token em `apps/mobile/.env`: `EXPO_PUBLIC_DND_API_ACCESS_ID`/`_SECRET`).
O PocketBase só guarda as escolhas do jogador (ids da API como texto; itens como `"arma:3"`).

Onde fica cada parte:

| Arquivo | O que faz |
|---|---|
| `packages/sdk/openapi/5e-fastapi.json` | Spec OpenAPI da API (gerado, não editar) |
| `packages/sdk/src/srd/5e-fastapi.d.ts` | Tipos gerados do spec (não editar) |
| `packages/sdk/src/srd/catalog.ts` | Consultas e conversão da API para os formatos do app (`toClass`, `toSpecies`, `toWeapon`…) |
| `packages/sdk/src/srd/rules.ts` | Regras lidas dos dados (perícias, conjuração, CA, equipamento…) |
| `packages/sdk/src/srd/reference.ts` | Listas que a API ainda não serve: perícias, idiomas, alinhamentos |
| `apps/mobile/src/lib/srd.ts` | Cliente do app, cache e `SRD_CACHE_VERSION` |

### Quando a API for atualizada

**Só dados novos** (outras classes, magias, itens, livros de 2014): não precisa mudar código, porque as
regras são genéricas e uma edição passa a aparecer na criação quando ganha classes (`fonte.edicao`: `5e` =
2014, `5.5e` = 2024). O app guarda as consultas no aparelho por 30 dias (`MAX_AGE_MS` em
`apps/mobile/src/lib/persistent-cache.ts`). Para todos verem os dados novos já, aumente `SRD_CACHE_VERSION`
em `apps/mobile/src/lib/srd.ts` e publique o app.

**Formato mudou** (endpoint ou campo novo, renomeado ou removido):

```sh
cd packages/sdk
CF_ACCESS_CLIENT_ID=... CF_ACCESS_CLIENT_SECRET=... bun run srd:spec   # baixa o spec novo
bun run srd:gen                                                         # regenera os tipos
cd ../.. && bun run typecheck                                           # mostra o que quebrou
```

Depois:
1. Ajuste as conversões em `catalog.ts` e, se preciso, as regras em `rules.ts` até o typecheck passar.
2. Aumente `SRD_CACHE_VERSION` (com uma linha no comentário dizendo o motivo), senão o app lê o formato
   antigo do cache.
3. Teste a criação de um personagem de ponta a ponta. Sem o token, rode a API localmente
   (`DND_ORIGENS_CORS='*'` para o Expo Web) e aponte o app com `EXPO_PUBLIC_DND_API_URL`.

**Pontos para revisar quando os dados chegarem:**
- Os textos de dano de arma ("1d8 Cortante") e de CA de armadura ("11 + mod. Des (máx. 2)") são lidos por
  `toWeapon`/`toArmor` em `catalog.ts`, que foram escritos sem dados reais. Confira com as tabelas carregadas.
- Se a API ganhar endpoints de perícias, idiomas ou alinhamentos, troque as listas de `reference.ts` por
  consultas no catálogo. As chaves de perícia e idioma já gravadas nos personagens precisam continuar valendo.
- O equipamento inicial liga cada item pelo nome (`findItem` em `rules.ts`). Um nome que não bater com o
  item da API fica guardado só pelo nome, em `equipment.custom`.
