<script lang="ts" generics="C extends object">
	import type { Snippet } from 'svelte';

	/**
	 * Mostra o estado de uma consulta (remote function): erro, carregando, falha do servidor ou, pronta, o conteúdo
	 * (`children` recebe o dado). `erro` é a mensagem para quando a consulta não chega; `style` ajusta o aviso.
	 */
	let {
		dados,
		erro,
		style,
		children
	}: {
		dados: { error?: unknown; current?: C };
		erro: string;
		style?: string;
		children: Snippet<[Exclude<C, { failure: string }>]>;
	} = $props();
</script>

{#if dados.error}
	<p class="aviso" role="alert" {style}>{erro}</p>
{:else if !dados.current}
	<p class="aviso" {style}>Carregando…</p>
{:else if 'failure' in dados.current}
	<p class="aviso" role="alert" {style}>{dados.current.failure}</p>
{:else}
	{@render children(dados.current as Exclude<C, { failure: string }>)}
{/if}

<style>
	.aviso {
		color: rgb(255 255 255 / 0.6);
	}

	.aviso[role='alert'] {
		color: var(--danger);
	}
</style>
