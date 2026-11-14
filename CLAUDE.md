# CLAUDE.md

## Arquitetura: app limpo, regras no core

O app (`apps/mobile`) é um ambiente externo: não tem regra de negócio. Regras, cache e integrações ficam em
módulos de `core/src/<módulo>/index.ts` (um namespace, como `User`, `Cache`, `Narration`), com um **port**
(interface) e **adapters** trocáveis. O app só implementa os ports da plataforma (disco, Keychain, player) e
liga as peças. O core não importa o `@dnf/sdk` (o sdk depende do core).

### Estrutura do app (`apps/mobile/src`)

```
src/
├── routes/                       rotas do Expo Router ("root" do plugin expo-router no app.json)
│   ├── _layout.tsx               export { default } from '../lib/features/navigation/pages/RootLayout';
│   ├── index.tsx                 export { default } from '../lib/features/home/pages/HomePage';
│   └── mesa/[id].tsx …           uma linha cada, sempre reexportando uma página
└── lib/
    ├── http.ts, crypto.ts, secure-storage(.web).ts, audio-file(.web).ts, narration.ts
    ├── components/               blocos de tela usados por mais de uma feature
    └── features/
        └── <nome-da-feature>/    ex.: auth, cache, character-create, character-sheet, home, mesa,
            ├── components/            navigation, srd, welcome
            ├── pages/            telas e layouts (as rotas reexportam daqui)
            ├── animations/
            └── functions/        hooks, contexto, cálculos, caches
```

- **`routes/`**: todo arquivo, inclusive os `_layout.tsx`, tem uma linha: `export { default } from '…/pages/X'`.
  A tela (e o `Stack` de navegação) fica na `pages/` da feature. Rota nova: crie a página na feature e a linha
  em `routes/`.
- **`lib/` (raiz)**: as libs do app, limpas. Cada uma faz só o mínimo para funcionar no app (iniciar o
  cliente HTTP, guardar o token, tocar o áudio), sem opções extras e sem regra de negócio.
- **`lib/features/<feature>/`**: só as subpastas que a feature usar. Uma feature pode importar de outra
  (ex.: `../../srd/functions`).
- **`lib/components/`**: `Header`, `PageHeading`, `SectionLabel`, `IconButton`, `FooterBar`, `ListCard`,
  `HighlightCard`, `Stat`, `ChipPicker`, `TilePicker`, `Badge`, `LoadState`. Os básicos (`Button`, `Chip`,
  `OptionCard`, tema, `DnfSpinner`) ficam em `@dnf/ui-react-native`. Antes de criar um bloco numa página, veja
  se já existe em um dos dois. Bloco usado por uma feature só fica em `components/` dela.
- Não crie `src/app`, `src/pages`, `src/features` nem `src/hooks`.

### API e banco (Postgres + Drizzle)

A API do DnF fica **toda no `core`** (nunca em `apps/`): rotas, regras de negócio e banco. O app e o DM-Control só
chamam a URL, pelos módulos do core (`User`, `Character`, `Mesa`, `Grid`), que falam com a API por `Http`. Hono + Drizzle +
Postgres. O PocketBase não existe mais: as regras que viviam nas API rules (quem lê e escreve o quê) agora são código
testado em `core/src/api`.

| Onde | O quê |
|---|---|
| `core/src/db` + `core/src/<módulo>/<módulo>.sql.ts` | `Db`: junta as tabelas Drizzle e guarda a conexão única do processo (`Db.use(url?)` abre na primeira chamada e reaproveita nas outras; `Db.migrateUp()`, `Db.close()`). Cada tabela fica ao lado do módulo (`user/user.sql.ts`, `character/character.sql.ts`, `mesa/mesa.sql.ts` com `mesas` e `mesa_members`, `grid/grid.sql.ts`, `narration/narration.sql.ts`); colunas comuns em `db/columns.ts`. Tabela nova: crie o `<módulo>.sql.ts` e registre em `db/index.ts` (colunas em snake_case, ids em texto). Migrations geradas em `core/drizzle/` (`bun run db:generate` na pasta `core`; rodam sozinhas ao subir a API) |
| `core/src/http` | `Http`: o cliente da API, sem Node (o app usa). `Http.init({ url, auth, cookie? })`, `Http.client().request(caminho, { método, query, body })`, `Http.ApiError` (`status`, `fields`; status 0 = sem rede), `Http.AuthStore` (guarda só o token no Keychain; o perfil fica em memória). `Http.scope(client, fn)`: no servidor do DM-Control cada requisição tem o login dela, e `Http.client()` devolve o dela |
| `core/src/<módulo>/index.ts` | Os schemas (Zod) e as chamadas do app (`Character.create`, `Mesa.join`, `Mesa.watch`…). Cada função valida e chama a API; nada de regra aqui que dependa do banco. Regras puras usadas dos dois lados ficam aqui (`Character.merge`) |
| `core/src/api` | `Api.create({ env })` (Hono). `auth.ts` (login por JWT), `users.ts` (cadastro, login, perfil, avatar), `characters.ts`, `mesas.ts` (inclui o SSE `/mesas/:id/events`), `grids.ts`, `nas.ts`, `srd.ts` (proxy da 5e-FastAPI, cache de 1 dia em memória), `tts.ts` (provedores de voz, falas na tabela `tts_cache`), `realtime.ts`, `page.ts`. Tudo exige login, menos `/health`, `/auth/{signup,login,logout,email-exists}` e `/files/avatars/*`. Quem não tem direito recebe 404 (igual a "não existe") |
| `core/server.ts` | Entrada (`bun run api`). Variáveis: `DATABASE_URL` e `AUTH_SECRET` (32+ caracteres) obrigatórias; `FILES_DIR` (avatares), `NAS_DIR`, `CORS_ORIGINS`, `DND_API_*`, `ELEVENLABS_API_KEY`, `TTS_PROVIDERS`, `PIPER_URL` |
| `core/tests/` | `api.test.ts` (todas as rotas e regras de acesso, com a 5e-FastAPI falsa) e `client.test.ts` (os módulos do core falando com a API de verdade). Precisam de `DATABASE_URL` (`docker compose up -d postgres`); sem ela são pulados |
| `core/scripts/migrate-from-pocketbase.ts` | Migração única: copia users (com o hash bcrypt, que continua valendo no login), characters, mesas, mesa_members, grids e grid_scenes do `pb_data/data.db` para o Postgres, mantendo os ids, e os avatares do `pb_data/storage` para `FILES_DIR`. `--replace` apaga e copia de novo; sem ele, recusa se o Postgres já tem usuários |

Login: `POST /auth/login` e `/auth/signup` devolvem `{ token, user }` (JWT de 30 dias; `User.refresh()` renova ao abrir o app).
O token vai em `Authorization: Bearer` (app) ou, na web do mesmo domínio, num cookie httpOnly `dnf_session` que a API define
(cabeçalho `X-DNF-Cookie: 1`; o cliente guarda só um token "de mentira" com o `exp`). O `EventSource` não manda cabeçalhos:
ele usa um bilhete de 60 s (`POST /auth/ticket`, `?ticket=`). Senhas: bcrypt (`Bun.password`). O DM-Control guarda o token
no cookie `dnf_auth` e o hook `hooks.server.ts` o põe no cliente da requisição (`API_URL` é a URL da API).

Local: `docker compose up -d --wait api` (API em `http://localhost:3000`, Postgres em `:5432`). O app acha a API em
`http://<IP do Metro>:3000` (`EXPO_PUBLIC_API_URL` troca). Produção: imagem `core/Dockerfile` (contexto = raiz do repo),
modelo do compose do NAS em `core/deploy/compose.yaml`.

### Código morto e duplicação (fallow)

O projeto mantém **0 código morto e 0 duplicação**, com a mesma configuração do `erp` (`.fallowrc.jsonc`, `minOccurrences: 3`,
fronteiras entre `routes`, `features`, `shared`, `core`, `sdk` e as libs de UI). Antes de commitar: `bun run fallow`
(ou `fallow:dead-code`, `fallow:dupes`, `fallow:health`). Entradas que ninguém importa (scripts, testes, o servidor)
ficam em `entry`; repetição que não vale extrair se dispensa onde mora, com `fallow-ignore-next-line code-duplication`.
Abstração nova recebe 1 parâmetro (até 3, se fizer sentido) e faz uma coisa só: `Db.use(url?)` (banco único),
`listing(spec, input)` (listagem paginada da API), `EstadoCarga` e `FormAcoes` (DM-Control).

### Serviços externos

Cada serviço externo expõe **um comando só**, com a configuração padrão fixa no adapter (sem parâmetros nem
variáveis de ambiente para trocar voz, modelo ou ajustes; do ambiente vem só a chave). Ex.: a narração é
`Narration.Port.createVoice(texto)` no core. No servidor, cada provedor é um adapter em
`core/src/api/tts.ts` com `available()` e `createVoice(text)`. `TTS_PROVIDERS` (ex.:
`elevenlabs`) define a ordem, e se um provedor cair o `/tts` tenta o próximo. Trocar a voz padrão:
edite o adapter e aumente `Narration.CACHE_VERSION`.

Vozes do app (cada uma é uma rota e um adapter `Narration.createHttpAdapter(rota)`):

| Voz | Rota | Provedor | Configuração no servidor |
|---|---|---|---|
| Narrador (subida de nível) | `/tts` | `TTS_PROVIDERS` (padrão `elevenlabs`) | `ELEVENLABS_API_KEY` |
| Grande Sábio | `/tts/sage` | `elevenlabs-sage` em `tts.ts` (mesma voz, mais entonação); se cair, `piper` (Piper do NAS, grátis) e os do narrador | `ELEVENLABS_API_KEY`, `PIPER_URL` |

O Piper fica de reserva: a voz dele é plana, sem entonação nem ritmo. O Piper do NAS (`rpg-piper`, voz `pt_BR-cadu-medium`) só fala o protocolo Wyoming via TCP, que a API não fala. A ponte `core/piper-http/server.py` (só biblioteca padrão do Python) recebe `GET /tts?text=...`, pede a
fala ao Piper e devolve o formato do `/tts`. O Piper não informa o tempo de cada letra: a ponte estima pela
duração, com pausa maior na pontuação. No NAS ele gera mais ou menos em tempo real (frase curta ≈ 3 s).

### Navegação e perfil

O app logado tem uma barra de abas (`routes/(tabs)/`: Início `/`, Mesas `/mesa`, Perfil `/perfil`; layout em
`navigation/pages/TabsLayout.tsx`). Telas de detalhe (ficha, mesa, edição do perfil) ficam na pilha acima, em `routes/`.

O perfil (`features/profile`) vive no registro do usuário no Postgres (`users`), pelas rotas `/users/:id` da API:
`avatar` (arquivo guardado em `FILES_DIR`, 5 MB, JPEG/PNG/WebP, validado pelo conteúdo; o servidor devolve o caminho
`/files/avatars/<id>/<arquivo>` e o cliente monta o endereço completo), `nickname` e `preferences` (JSON: `narration`,
`sounds`; campo novo entra em `User.Preferences` com padrão, sem migration). A sessão (`useSession().session.user`) é a fonte
de leitura; `User.update`, `User.setAvatar` e `User.removeAvatar` a atualizam a cada gravação.
Fora de componentes, `currentPreferences()` diz se a narração e os sons estão ligados.

A capa da mesa é colocada pelo mestre no DM-Control (pasta do NAS, caminho em `mesas.cover`). O app a lê por
`/nas/<caminho>` da API (`core/src/api/nas.ts`, mesmas regras do DM-Control: mestre lê tudo da mesa, jogador só
`imagens/`), com o token no `Authorization` (`mesa/functions/cover.ts`, `mesaCover(mesa)`). Na API a pasta do NAS é `NAS_DIR`
(no container, `/data/nas`, somente leitura; no NAS, `/srv/apps/dnf-db/nas`) e o Traefik encaminha `/nas/` do `dnf.developale.com`.
O DM-Control (hoje só local) precisa gravar nela: o arquivo de `mesas.cover` tem que existir em `nas/<mesaID>/imagens/`.

### Magias do personagem

Tela própria em `routes/character/[id]/spells.tsx` (`character-sheet/pages/SpellsPage.tsx`); a ficha só mostra o resumo
(`SpellsSummary`). Em `Character.spellcasting.spells` cada magia leva `classKey` (classe que a deu; sem ela vale a primeira
conjuradora) e `free` (talento/espécie: sempre preparada, fora dos limites). Limites por classe e nível: `spellCountsAt`
(classes) e `subclassSpellCounts` (Cavaleiro Místico/Trapaceiro Arcano: tabela da subclasse na API ou a de um terço; lista do
Mago). Três modelos: lista inteira (Clérigo, Druida, Paladino), grimório (Mago: 6 + 2 por nível) e conhecidas (Bardo,
Feiticeiro, Bruxo, Patrulheiro). O modelo vem do nome da classe (`spellModel`), não do rótulo da tabela: no 2024 Bardo, Bruxo, Feiticeiro e Guardião também têm
"Magias Preparadas", mas só trocam uma ao subir de nível (`spellcasting.swaps[classKey]` guarda o nível de classe da última troca).
Clérigo, Druida, Paladino e Artífice preparam com `prepareOpen` (o descanso longo abre, "Confirmar preparo" fecha; vagas novas do
nível podem ser preenchidas). "Liberar troca" é a saída para o mestre. Magias sempre preparadas de domínio/patrono/círculo vêm da
subclasse (`alwaysPrepared`, por nome, resolvidas por `srd.spellsByName`) e aparecem fora dos limites. Se a API não mandar
`conjuracao` no Cavaleiro Místico/Trapaceiro Arcano, `toSubclass` assume conjurador de um terço (Int).

### Dados do app: TanStack Query

Toda leitura e gravação passa por hooks do TanStack Query, em `features/<feature>/functions/queries.ts`. As telas
só chamam os hooks (`useClasses(edition)`, `useCharacter(id)`, `useMesas()`…) e leem `loading`/`error`/`ready`
(`QueryState` em `lib/query-state.ts`); nada de `useEffect` buscando, chave de cache ou `srd.*`/`Character.*` na tela.

| Onde | O quê |
|---|---|
| `lib/query-client.ts` | `QueryClient` único, `PLAYER_STALE_TIME`, `PLAYER_CACHE_VERSION`, rede (NetInfo) e foco (AppState) no celular, `clearPlayerData()` |
| `features/srd/functions/queries.ts` | Compêndio (`['srd', chave]`): fresco para sempre, cache em disco do `Cache` do core |
| `features/character-sheet/functions/queries.ts` | Personagens (`['character', …]`): `useCharacters`, `useCharacter`, `useUpdateCharacter` (otimista), `useCreateCharacter`, `useRemoveCharacter` |
| `features/mesa/functions/queries.ts` | Mesas (`['mesa', …]`): listas, ações e `useMesaRealtime(id)` (o evento SSE da API invalida a mesa) |
| `features/cache/functions/query-persister.ts` | Guarda só `character` e `mesa` no aparelho (7 dias): o app abre com o último estado |

- Dados do jogador têm `staleTime` de 30 s e buscam de novo ao voltar à tela (`useRefetchOnFocus`), ao voltar o foco e ao reconectar.
  Sem rede, uma gravação espera e segue sozinha quando a conexão volta (não sobrevive a fechar o app).
- Mutations invalidam o que mudou (`invalidateQueries`); a ficha usa atualização otimista com volta atrás se o servidor recusar.
- Mudou o formato de `Character.Info` ou `Mesa.Info`? Aumente `PLAYER_CACHE_VERSION`. Logout e token recusado chamam `clearPlayerData()`.
- Devtools: `QueryDevtools.web.tsx` (só web, em desenvolvimento).

## API de regras (5e-FastAPI)

As regras de D&D (classes, espécies, antecedentes, talentos, magias, equipamento) vêm da
[5e-FastAPI](https://github.com/AlessandroFTunes/5e-FastAPI), em `https://5e-fastapi.developale.com`, atrás do
Cloudflare Access. O app não tem o token: chama `/srd/*` na API (`core/src/api/srd.ts`), que repassa
com o service token das variáveis `DND_API_ACCESS_ID`/`_SECRET` do servidor.
O Postgres só guarda as escolhas do jogador (ids da API como texto; itens como `"arma:3"`).

Onde fica cada parte:

| Arquivo | O que faz |
|---|---|
| `packages/sdk/openapi/5e-fastapi.json` | Spec OpenAPI da API (gerado, não editar) |
| `packages/sdk/src/srd/5e-fastapi.d.ts` | Tipos gerados do spec (não editar) |
| `packages/sdk/src/srd/catalog.ts` | Consultas e conversão da API para os formatos do app (`toClass`, `toSpecies`, `toWeapon`…) |
| `packages/sdk/src/srd/rules.ts` | Regras lidas dos dados (perícias, conjuração, CA, equipamento…) |
| `packages/sdk/src/srd/reference.ts` | Listas que a API ainda não serve: perícias, idiomas, alinhamentos |
| `core/src/cache` | Cache em memória → disco → rede (`Cache.Store` é o port do armazenamento) |
| `apps/mobile/src/lib/features/srd/functions` | `client.ts`: catálogo, cache em disco e `SRD_CACHE_VERSION`. `queries.ts`: todas as consultas como hooks do TanStack Query (`useClasses(edition)`, `useSpells(…)`). As telas só chamam esses hooks, sem `srd.*` nem chave de cache |

### Quando a API for atualizada

**Só dados novos** (outras classes, magias, itens, livros de 2014): não precisa mudar código, porque as
regras são genéricas e uma edição passa a aparecer na criação quando ganha classes (`fonte.edicao`: `5e` =
2014, `5.5e` = 2024). Homebrew (`edicao: homebrew`) vale para as duas edições. Na criação, uma classe da outra
edição sem equivalente nesta também entra (`adaptedFrom`, ex.: o Artífice do Tasha na criação 2024), e
`srd.spells(classe, círculo, edição)` mostra uma vez só a magia que existe nos dois livros, ficando a da edição
do personagem. O app guarda as consultas no aparelho por 30 dias (`MAX_AGE_MS` em
`apps/mobile/src/lib/features/cache/functions/persistent-cache.ts`). Para todos verem os dados novos já, aumente `SRD_CACHE_VERSION`
em `apps/mobile/src/lib/features/srd/functions/client.ts` e publique o app.

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

## Deploy (NAS)

Tudo roda no NAS, atrás do Traefik. Para entrar: `ssh ale@nas-ale`. Os apps ficam em `/srv/apps/`.

| O quê | Onde no NAS | Como publicar |
|---|---|---|
| API do DnF (`https://dnf.developale.com`, caminhos `/auth`, `/users`, `/characters`, `/mesas`, `/grids`, `/srd`, `/tts`, `/nas`, `/files`) + Postgres | `/srv/apps/dnf-api` (containers `dnf-api` e `dnf-postgres`; modelo em `core/deploy/compose.yaml`, `.env` a partir de `core/deploy/.env.example`) | Na raiz do repo: `docker build -f core/Dockerfile -t dnf-api:latest .`, enviar a imagem (`docker save dnf-api:latest \| ssh ale@nas-ale docker load`) e `ssh ale@nas-ale 'cd /srv/apps/dnf-api && docker compose up -d'`. As migrations rodam sozinhas ao subir |
| Ponte do Piper (voz do Grande Sábio) | `/srv/apps/piper-http` (container `piper-http`, redes `proxy` e `rpg-piper_default`, sem porta exposta) | Copiar `core/piper-http/server.py` para lá e `docker compose restart piper-http` |
| App web (`https://dnf.developale.com`) | `/srv/apps/dnf-web` (nginx, container `dnf-web`) | Gerar o build web (`EXPO_PUBLIC_API_URL` = o próprio domínio) e trocar o `dist/` |

- O `.env` da API (`POSTGRES_PASSWORD`, `AUTH_SECRET`, chaves dos provedores de voz, `TTS_PROVIDERS` e o token do Cloudflare Access) fica só no NAS, em `/srv/apps/dnf-api/.env`.
- **Migração do PocketBase (uma vez):** parar o `dnf-db`, copiar `pb_data/` para a máquina com o repo, rodar
  `DATABASE_URL=… FILES_DIR=… PB_DATA=…/data.db bun run migrate:pocketbase` na pasta `core` (por um túnel `ssh -L 5432:…` ou no próprio NAS),
  subir a API nova e só depois desligar o `dnf-db`, o Redis e o Webdis. A pasta do NAS (`/srv/apps/dnf-db/nas`) é a mesma que a API lê.
- Depois de subir, o Traefik só roteia quando o container fica `healthy` (~15 s).

### Segurança do NAS (aplicada em 2026-11-01)

- O HTTPS termina na Cloudflare: o `cloudflared` (no host) fala com o Traefik por `[::1]:80`. A porta 80 só
  escuta em `127.0.0.1` e `[::1]`; o Traefik só confia nos cabeçalhos `X-Forwarded-*` de IPs do próprio NAS.
- Rate limit do Traefik (por `CF-Connecting-IP`), nos labels do `dnf-api`: geral 600/min, login, cadastro e `email-exists`
  20/min, `/tts` e busca de mesa por código 10/min.
- O Postgres só escuta na rede interna da stack (sem porta publicada); o `dnf-api` roda como o usuário `bun` (sem root).
- Dozzle, o outro PocketBase e o projects-www publicam a porta só em loopback; o Directus (8056) continua na rede local porque o `PUBLIC_URL` dele usa o IP da LAN.
- Cada arquivo alterado no NAS tem um `.bak-seguranca*`, `.bak-nonroot-*` ou `.bak-portas-*` ao lado.
