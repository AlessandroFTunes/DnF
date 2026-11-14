# DnF — ficha de D&D

```
core/               regras de negócio, API (Hono) e banco (Postgres + Drizzle)
  drizzle/          migrations do banco
  server.ts         entrada da API
  src/<módulo>/     um módulo por pasta: @dnf/core/user, @dnf/core/character
apps/
  mobile/           app React Native + TS (Expo + expo-router)
packages/
  sdk/              cliente tipado da 5e-FastAPI (@dnf/sdk)
  ui/react-native/  componentes React Native compartilhados (@dnf/ui-react-native)
  ui/svelte/        componentes Svelte compartilhados (@dnf/ui-svelte)
  tsconfig/         config TS compartilhada
```

Dependências permitidas: `apps → packages → core`. O `core/src` não importa nada do projeto.

O `core` só expõe módulos (campo `exports`): cada pasta em `core/src/` com um `index.ts` vira
`@dnf/core/<pasta>`. Arquivos internos (`@dnf/core/http/...`) e a raiz (`@dnf/core`) não são importáveis.

```ts
import { User } from '@dnf/core/user';
import { characterSchema } from '@dnf/core/character';
```

## Regras de D&D (5e-FastAPI)

Classes, espécies, antecedentes, talentos, magias e equipamento vêm da
[5e-FastAPI](https://github.com/AlessandroFTunes/5e-FastAPI) (`https://5e-fastapi.developale.com`), já em
português, com cliente tipado gerado do spec OpenAPI em `packages/sdk/openapi/5e-fastapi.json`:

```ts
import { createSrdCatalog, createSrdClient } from '@dnf/sdk/srd';

const client = createSrdClient({ accessToken: { clientId, clientSecret } });
const { data } = await client.GET('/api/v1/magias', { params: { query: { circulo: 3 } } });

const srd = createSrdCatalog(client); // consultas do app: srd.classes('2024'), srd.classDetail('1')…
```

A API fica atrás do Cloudflare Access. O token não vai no app: ele chama `/srd/*` na API do DnF
(`core/src/api/srd.ts`), que exige login e repassa com `DND_API_ACCESS_ID`/`DND_API_ACCESS_SECRET` (variáveis
do servidor). `EXPO_PUBLIC_DND_API_URL` aponta o app direto para outra instância, ex.: `http://localhost:8000`.

Ao subir de nível, a celebração narra o que o personagem ganhou ("Novo nível alcançado: você adquiriu…") com a
ElevenLabs. O app chama `/tts?text=…` na API (`core/src/api/tts.ts`), que exige login e gera o mp3 com
`ELEVENLABS_API_KEY` (variável do servidor; a voz e o modelo ficam fixos no adapter). A voz fala no tom do "Grande Sábio", e cada ganho aparece na tela quando é dito: a animação espera a fala ficar pronta. Os efeitos
de fundo (ambientação da caverna e os golpes do dado) ficam em `apps/mobile/assets/sounds`, gerados uma vez pela
ElevenLabs com `bun run sounds` (prompts em `apps/mobile/scripts/sounds.ts`). Sem a chave, só a voz falta.

A edição de cada registro vem do livro (`fonte.edicao`): `5e` = regras de 2014, `5.5e` = regras de 2024.
Uma edição sem classes na API aparece desabilitada na criação. O personagem guarda só os ids da API
(`classKey: "1"`, itens como `"arma:3"`); as regras são lidas da API na ficha.

Perícias, idiomas e alinhamentos ainda não têm endpoint na API: vêm de listas fixas em
`packages/sdk/src/srd/reference.ts` até a API ganhar esses endpoints.

Para atualizar o spec e os tipos (com o token no ambiente: `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`):
`cd packages/sdk && bun run srd:spec && bun run srd:gen`.

## Desenvolvimento

```sh
bun install
cd apps/mobile && bun expo start   # sobe o Postgres e a API (Docker) e depois o Metro
bun run db:logs                    # logs da API (em apps/mobile)
bun run db:down                    # derruba a API e o Postgres
```

API local: http://localhost:3000 (`/health`). Testes do core com banco: `docker compose up -d postgres` e
`DATABASE_URL=postgres://dnf:dnf@localhost:5432/dnf bun test` na pasta `core`.
