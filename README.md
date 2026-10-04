# DnF — ficha de D&D

```
core/               regras de negócio + banco (PocketBase)
  pb_migrations/    schema e API rules
  pb_hooks/         hooks do servidor
  src/              regras de D&D em TS puro (@dnf/core)
apps/
  mobile/           app React Native + TS (Expo + expo-router)
packages/
  sdk/              cliente tipado do PocketBase (@dnf/sdk)
  tsconfig/         config TS compartilhada
```

Dependências permitidas: `apps → packages → core`. O `core/src` não importa nada do projeto.

## Desenvolvimento

```sh
bun install
cd apps/mobile && bun expo start   # sobe o PocketBase (Docker) e depois o Metro
bun run db:logs                    # logs do PocketBase (em apps/mobile)
bun run db:down                    # derruba o PocketBase
```

PocketBase local: http://localhost:8090/_/ — superuser `admin@dnf.local` / `dnf-dev-password`
(sobrescreva com `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`).
