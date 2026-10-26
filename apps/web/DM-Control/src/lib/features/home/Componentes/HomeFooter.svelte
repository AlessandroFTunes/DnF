<script lang="ts">
	import HomeSignup from './HomeSignup.svelte';
</script>

<footer>
	<HomeSignup text="Pronto para mestrar? Informe seu email para criar ou acessar sua conta." />
	<p>DM Control · Painel do mestre para suas mesas de D&amp;D</p>
</footer>

<style>
	footer {
		position: relative;
		z-index: 1;
		max-width: var(--maxw);
		margin: 0 auto;
		padding: 4rem 1.5rem 3rem;
	}

	p {
		margin: 3rem 0 0;
		font-size: 0.85rem;
		text-align: center;
		color: rgb(255 255 255 / 0.55);
	}
</style>
