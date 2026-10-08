# DnF — ficha de D&D

```
core/               regras de negócio + banco (PocketBase)
  pb_migrations/    schema e API rules
  pb_hooks/         hooks do servidor
  src/<módulo>/     um módulo por pasta: @dnf/core/user, @dnf/core/character
apps/
  mobile/           app React Native + TS (Expo + expo-router)
packages/
  sdk/              cliente tipado do PocketBase (@dnf/sdk)
  ui/react-native/  componentes React Native compartilhados (@dnf/ui-react-native)
  ui/svelte/        componentes Svelte compartilhados (@dnf/ui-svelte)
  tsconfig/         config TS compartilhada
```

Dependências permitidas: `apps → packages → core`. O `core/src` não importa nada do projeto.

O `core` só expõe módulos (campo `exports`): cada pasta em `core/src/` com um `index.ts` vira
`@dnf/core/<pasta>`. Arquivos internos (`@dnf/core/pocketbase/order`) e a raiz (`@dnf/core`) não são importáveis.

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

A API fica atrás do Cloudflare Access. O token não vai no app: ele chama `/srd/*` no PocketBase
(`core/pb_hooks/srd.pb.js`), que exige login e repassa com `DND_API_ACCESS_ID`/`DND_API_ACCESS_SECRET` (variáveis
do servidor). `EXPO_PUBLIC_DND_API_URL` aponta o app direto para outra instância, ex.: `http://localhost:8000`.

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
cd apps/mobile && bun expo start   # sobe o PocketBase (Docker) e depois o Metro
bun run db:logs                    # logs do PocketBase (em apps/mobile)
bun run db:down                    # derruba o PocketBase
```

PocketBase local: http://localhost:8090/_/ — superuser `admin@dnf.local` / `dnf-dev-password`
(sobrescreva com `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`).
