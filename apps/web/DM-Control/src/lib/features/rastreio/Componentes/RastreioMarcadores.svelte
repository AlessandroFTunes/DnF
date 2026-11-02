<script lang="ts">
	import type { Attachment } from 'svelte/attachments';

	let { ids }: { ids: number[] } = $props();

	let falha = $state<string>();

	// O OpenCV só carrega aqui, no navegador, para gerar a imagem de cada marcador.
	function marcador(id: number): Attachment<HTMLCanvasElement> {
		return (canvas) => {
			void (async () => {
				try {
					const { TrackingOpenCv } = await import('@dnf/core/trackingopencv');
					const imagem = await TrackingOpenCv.renderMarker(id, 240);
					canvas.width = imagem.width;
					canvas.height = imagem.height;
					canvas
						.getContext('2d')!
						.putImageData(new ImageData(new Uint8ClampedArray(imagem.data), imagem.width, imagem.height), 0, 0);
				} catch {
					falha = 'Não foi possível gerar os marcadores.';
				}
			})();
		};
	}
</script>

{#if falha}<p class="aviso" role="alert">{falha}</p>{/if}

<ul>
	{#each ids as id (id)}
		<li>
			<canvas {@attach marcador(id)} aria-label="Marcador {id}"></canvas>
			<span>#{id}</span>
		</li>
	{/each}
</ul>

<style>
	ul {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
		gap: 0.8rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}

	canvas {
		width: 100%;
		aspect-ratio: 1;
		background: #fff;
		border-radius: 0.4rem;
	}

	span {
		color: rgb(255 255 255 / 0.7);
		font-size: 0.85rem;
	}

	.aviso {
		color: var(--danger);
	}
</style>
