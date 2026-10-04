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

### Complemento próprio (2024, Xanathar e Tasha)

A Open5e só tem o que está no SRD — de 2024, só 4 dos 16 antecedentes, e nada do Guia de Xanathar nem
do Caldeirão de Tasha (não são conteúdo aberto). O resto vem da nossa API:
coleções públicas (somente leitura) no PocketBase, no mesmo formato da Open5e, que o catálogo junta
com a Open5e (`createSrdCatalog(client, { complement: createPocketBaseComplement(pb) })`).

| Coleção | Conteúdo |
|---|---|
| `srd_backgrounds` | Os 12 antecedentes de 2024 fora do SRD (Artesão, Charlatão, Artista, Fazendeiro, Guarda, Guia, Eremita, Mercador, Nobre, Marinheiro, Escriba, Andarilho) |
| `srd_feats` | Talentos de origem que eles usam (Fabricante, Curandeiro, Sortudo, Músico, Brigão de Taverna, Robusto); talentos raciais do Xanathar (15) e talentos do Tasha (15) |
| `srd_species` | Aasimar; Linhagem Customizada (Tasha) |
| `srd_subclasses` | Subclasses do Xanathar (31) e do Tasha (26, sem as do Artífice), com as habilidades por nível |
| `srd_spells` | Magias do Xanathar (94) e do Tasha (21), com as listas de classe (sem o Artífice) |

Só a mecânica vem dos livros; as descrições são texto próprio e resumido (o texto dos livros não é livre).
O conteúdo dos livros é de 2014: numa classe de 2024, as subclasses entram adaptadas (habilidades de nível
1 e 2 passam para o 3), como as subclasses de 2014 da Open5e.
Cada registro tem `i18n` com a tradução em pt-BR, que o app registra no tradutor (`tr`).

O conteúdo fica em `core/seed/srd-complement.json` (2024) e `core/seed/books/` (Xanathar e Tasha). Para importar (ou atualizar) num PocketBase:

```sh
cd core && bun run seed:complement   # local; em outro servidor: PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD
```

Dá para adicionar conteúdo pelo painel do PocketBase também; o app pega na próxima vez que abrir.

## Desenvolvimento

```sh
bun install
cd apps/mobile && bun expo start   # sobe o PocketBase (Docker) e depois o Metro
bun run db:logs                    # logs do PocketBase (em apps/mobile)
bun run db:down                    # derruba o PocketBase
```

PocketBase local: http://localhost:8090/_/ — superuser `admin@dnf.local` / `dnf-dev-password`
(sobrescreva com `PB_ADMIN_EMAIL` / `PB_ADMIN_PASSWORD`).
