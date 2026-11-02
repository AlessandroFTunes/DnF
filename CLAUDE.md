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
    ├── pocketbase.ts, crypto.ts, secure-storage(.web).ts, audio-file(.web).ts, narration.ts
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
  PocketBase, guardar o token, tocar o áudio), sem opções extras e sem regra de negócio.
- **`lib/features/<feature>/`**: só as subpastas que a feature usar. Uma feature pode importar de outra
  (ex.: `../../srd/functions`).
- **`lib/components/`**: `Header`, `PageHeading`, `SectionLabel`, `IconButton`, `FooterBar`, `ListCard`,
  `HighlightCard`, `Stat`, `ChipPicker`, `TilePicker`, `Badge`, `LoadState`. Os básicos (`Button`, `Chip`,
  `OptionCard`, tema, `DnfSpinner`) ficam em `@dnf/ui-react-native`. Antes de criar um bloco numa página, veja
  se já existe em um dos dois. Bloco usado por uma feature só fica em `components/` dela.
- Não crie `src/app`, `src/pages`, `src/features` nem `src/hooks`.

### Serviços externos

Cada serviço externo expõe **um comando só**, com a configuração padrão fixa no adapter (sem parâmetros nem
variáveis de ambiente para trocar voz, modelo ou ajustes; do ambiente vem só a chave). Ex.: a narração é
`Narration.Port.createVoice(texto)` no core. No servidor, cada provedor é um arquivo
`core/pb_hooks/tts/<provedor>.js` com `available()` e `createVoice(text)`. `TTS_PROVIDERS` (ex.:
`elevenlabs`) define a ordem, e se um provedor cair o `/tts` tenta o próximo. Trocar a voz padrão:
edite o adapter e aumente `Narration.CACHE_VERSION`.

Vozes do app (cada uma é uma rota e um adapter `Narration.createPocketBaseAdapter(pb, rota)`):

| Voz | Rota | Provedor | Configuração no servidor |
|---|---|---|---|
| Narrador (subida de nível) | `/tts` | `TTS_PROVIDERS` (padrão `elevenlabs`) | `ELEVENLABS_API_KEY` |
| Grande Sábio | `/tts/sage` | `tts/elevenlabs-sage.js` (mesma voz, mais entonação); se cair, `tts/piper.js` (Piper do NAS, grátis) e os do narrador | `ELEVENLABS_API_KEY`, `PIPER_URL` |

O Piper fica de reserva: a voz dele é plana, sem entonação nem ritmo. O Piper do NAS (`rpg-piper`, voz `pt_BR-cadu-medium`) só fala o protocolo Wyoming via TCP, que o PocketBase não
alcança. A ponte `core/piper-http/server.py` (só biblioteca padrão do Python) recebe `GET /tts?text=...`, pede a
fala ao Piper e devolve o formato do `/tts`. O Piper não informa o tempo de cada letra: a ponte estima pela
duração, com pausa maior na pontuação. No NAS ele gera mais ou menos em tempo real (frase curta ≈ 3 s).

## API de regras (5e-FastAPI)

As regras de D&D (classes, espécies, antecedentes, talentos, magias, equipamento) vêm da
[5e-FastAPI](https://github.com/AlessandroFTunes/5e-FastAPI), em `https://5e-fastapi.developale.com`, atrás do
Cloudflare Access. O app não tem o token: chama `/srd/*` no PocketBase (`core/pb_hooks/srd.pb.js`), que repassa
com o service token das variáveis `DND_API_ACCESS_ID`/`_SECRET` do servidor.
O PocketBase só guarda as escolhas do jogador (ids da API como texto; itens como `"arma:3"`).

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
| PocketBase (`https://dnf-db.developale.com`) | `/srv/apps/dnf-db` (container `dnf-db`) | Copiar `core/pb_hooks/*` (com a pasta `tts/`) para `pb_hooks/` (e `core/pb_migrations/*` para `pb_migrations/`, se mudou), depois `docker compose restart dnf-db` |
| Ponte do Piper (voz do Grande Sábio) | `/srv/apps/piper-http` (container `piper-http`, redes `proxy` e `rpg-piper_default`, sem porta exposta) | Copiar `core/piper-http/server.py` para lá e `docker compose restart piper-http` |
| Cache do `/srd` (Redis, 64 MB, respostas por 1 dia) | Mesma stack do `dnf-db`: containers `dnf-redis` e `dnf-webdis` (ponte HTTP, porque os hooks não abrem TCP), só na rede interna da stack | Config do Webdis em `core/redis/webdis.json` (só `GET`/`SETEX`/`PING`) → `/srv/apps/dnf-db/webdis.json`. `CACHE_URL=http://dnf-webdis:7379` no `.env`; sem ele, ou com o Redis fora, o `/srd` repassa direto. Limpar: `docker exec dnf-redis redis-cli flushall` |
| App web (`https://dnf.developale.com`) | `/srv/apps/dnf-web` (nginx, container `dnf-web`) | `sh apps/mobile/scripts/deploy.sh` (gera o build web e troca `dist/`) |

```sh
scp -r core/pb_hooks/tts.pb.js core/pb_hooks/tts ale@nas-ale:/srv/apps/dnf-db/pb_hooks/
ssh ale@nas-ale 'cd /srv/apps/dnf-db && docker compose restart dnf-db'
```

- O `.env` do PocketBase (chaves dos provedores de voz, `TTS_PROVIDERS` e o token do Cloudflare Access) fica só no NAS, em `/srv/apps/dnf-db/.env`.
- Depois de reiniciar, o Traefik só volta a rotear quando o container fica `healthy` (~30 s). Até lá,
  `dnf-db.developale.com` responde 404.

### Segurança do NAS (aplicada em 2026-11-01)

- O HTTPS termina na Cloudflare: o `cloudflared` (no host) fala com o Traefik por `[::1]:80`. A porta 80 só
  escuta em `127.0.0.1` e `[::1]`; o Traefik só confia nos cabeçalhos `X-Forwarded-*` de IPs do próprio NAS.
- O painel `/_/` e `/api/collections/_superusers` do `dnf-db` respondem 403 pelo domínio. Para administrar:
  `ssh -L 8091:127.0.0.1:8091 ale@nas-ale` e abrir `http://localhost:8091/_/`.
- Rate limit do Traefik (por `CF-Connecting-IP`), nos labels do `dnf-db`: geral 600/min, login e `email-exists`
  20/min, `/tts` 10/min, busca de mesa por código 10/min.
- `pb_hooks` e `pb_migrations` são montados somente leitura no container: mude o schema só pelas migrations do repo.
- O `dnf-db` roda como uid 10001 (dono de `pb_data`). Dozzle, o outro PocketBase e o projects-www publicam a porta só em
  loopback; o Directus (8056) continua na rede local porque o `PUBLIC_URL` dele usa o IP da LAN.
- Cada arquivo alterado no NAS tem um `.bak-seguranca*`, `.bak-nonroot-*` ou `.bak-portas-*` ao lado.
