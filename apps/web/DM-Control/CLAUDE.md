# CLAUDE.md

App SvelteKit (Svelte 5) do DM-Control. Veja também `AGENTS.md` (MCP do Svelte e autofixer).

## Regras de Svelte

- **Proibido `$effect`** (e `$effect.pre`). Nada de sincronizar estado com efeitos.
- **Canvas:** use `{@attach ...}` (attachments), nunca `$effect`/`onMount` para ligar o canvas.
- **Reatividade:** use `$state` + `$derived`. Quando precisar de um valor com fallback, derive-o
  (`$derived(props.valor ?? padrao)`) em vez de copiar para outro estado.
- Antes de entregar código Svelte, rode o `svelte-autofixer` até não restar avisos.

## Typecheck

- **Só rode o typecheck (`svelte-check`, `tsc`, `bun run check`) se o usuário pedir.** Ele pesa muito e trava o
  computador dele. O `svelte-autofixer` pode continuar sendo usado.

## Escopo das mudanças

- **1 prompt = pequenas mudanças.** Faça só o que o prompt pediu, em passos curtos.
- **Não refatore sem ordem direta.** Nada de renomear, mover, reorganizar ou "melhorar" código que não faz
  parte do pedido. Se achar algo que merece refatoração, avise em uma linha e espere o usuário mandar.

## Arquitetura

### Rotas

Os arquivos em `src/routes/**/+page.svelte` só renderizam uma página da feature, repassando as props:

```svelte
<script lang="ts">
	import { PersonagemPage } from '$lib/features/personagem';
	let props = $props();
</script>

<PersonagemPage {...props} />
```

Nada de markup, lógica ou estilo na rota.

### Pages

- Uma `AlgumaCoisaPage` é composta **apenas por componentes**, que recebem os dados por props.
- A Page não tem fallback nem reatividade própria: só monta e repassa.
- **Todo fallback e toda reatividade ficam nos componentes** (`$state`/`$derived` dentro deles).

### Dados

- **Toda query passa por remote functions** (`api.remote.ts` da feature). Sem `fetch` solto, sem `load` que
  busque dados, sem chamar o `core` (PocketBase / 5e-FastAPI) direto de componente.
- **Nenhum componente recebe dados diretamente do `core`**: os dados vêm das remote functions, já
  no formato que o componente usa.
- Regras de D&D continuam vindo da API de regras; o banco guarda só as escolhas do jogador.

### Features

Cada feature (`personagem`, `ficha`, `mesa`, `monstro`) fica em `src/lib/features/<nome-da-feature>/`:

```
src/lib/features/<feature>/
├── Pages/          # AlgumaCoisaPage.svelte (composição de componentes)
├── Componentes/    # componentes que recebem props e cuidam de fallback/reatividade
├── animation/      # TODA animação do componente (transições, motion, keyframes)
├── api.remote.ts   # remote functions (queries/commands/forms) da feature
└── index.ts        # exporta as Pages
```

- **Animações só em `animation/`** dentro da feature do componente; o componente importa de lá.
- Código compartilhado entre features fica em `src/lib/` fora de `features/`.

## Checklist antes de entregar

- [ ] Typecheck não foi rodado (a menos que o usuário tenha pedido).
- [ ] Nenhum `$effect`.
- [ ] A rota só tem `<XPage {...props} />`.
- [ ] A Page só compõe componentes, sem fallback nem estado.
- [ ] Toda leitura/escrita de dados passa por `api.remote.ts`.
- [ ] Animações estão em `animation/` da feature.
