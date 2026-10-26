<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<div class="wrap">
	<aside>
		<span class="die" aria-hidden="true">🎲</span>
		<div>
			<strong>O mesmo login do app DnF.</strong>
			<span>Entre com a conta dos seus jogadores e veja a mesa inteira num só lugar.</span>
		</div>
		<a class="lift" href={resolve('/about')}>Saiba mais</a>
	</aside>
</div>

<style>
	.wrap {
		position: relative;
		z-index: 1;
		max-width: var(--maxw);
		margin: 0 auto;
		padding: 0 1.5rem;
	}

	aside {
		display: flex;
		align-items: center;
		gap: 1.2rem;
		padding: 1rem 1.5rem;
		border-radius: 1rem;
		background: linear-gradient(90deg, #1d1244, #2b1650 60%, #1a0f3b);
	}

	.die {
		font-size: 2.6rem;
	}

	div {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.15rem;
		font-size: 0.9rem;
	}

	strong {
		font-size: 1.05rem;
	}

	a {
		padding: 0.55rem 1rem;
		border: 1px solid transparent;
		border-radius: 4px;
		background: rgb(255 255 255 / 0.14);
		color: #fff;
		font-size: 0.9rem;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}

	@media (max-width: 36rem) {
		aside {
			flex-wrap: wrap;
		}
	}
</style>
