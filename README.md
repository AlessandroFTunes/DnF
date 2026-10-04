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

## SRD (regras de D&D)

Conteúdo do SRD 5.1 (5e) e 5.2 (5.5e) vem online da [Open5e](https://api.open5e.com), com cliente tipado
gerado do spec OpenAPI em `packages/sdk/openapi/open5e.yaml`:

```ts
import { createSrdClient, SRD_DOCUMENTS } from '@dnf/sdk/srd';

const srd = createSrdClient();
const { data } = await srd.GET('/v2/spells/', {
  params: { query: { document__key: SRD_DOCUMENTS['2024'], level: 3 } },
});
```

Para atualizar o spec e os tipos: `cd packages/sdk && bun run srd:spec && bun run srd:gen`.

## Desenvolvimento

```sh
bun install
cd apps/mobile && bun expo start   # sobe o PocketBase (Docker) e depois o Metro
bun run db:logs                    # logs do PocketBase (em apps/mobile)
bun run db:down                    # derruba o PocketBase
```

PocketBase local: http://localhost:8090/_/ — superuser `admin@dnf.local` / `dnf-dev-password`
(sobrescreva com `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`).
