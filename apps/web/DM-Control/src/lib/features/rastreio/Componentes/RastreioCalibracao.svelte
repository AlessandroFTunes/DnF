<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Calibration, Tracking } from '@dnf/core/tracking';
	import RastreioMarcadores from './RastreioMarcadores.svelte';

	let { id }: { id: string } = $props();

	/** Marcadores dos cantos da mesa: superior esq., superior dir., inferior dir., inferior esq. */
	const CANTOS: Calibration.CornerIds = [0, 1, 2, 3];
	const NOMES_CANTOS = ['Sup. esq.', 'Sup. dir.', 'Inf. dir.', 'Inf. esq.'];
	/** Marcadores de teste para os tokens. */
	const TOKENS_TESTE = [4, 5, 6, 7];
	const INTERVALO_MS = 100;

	let video = $state<HTMLVideoElement>();
	let overlay = $state<HTMLCanvasElement>();
	let estado = $state<'parado' | 'iniciando' | 'rodando'>('parado');
	let falha = $state<string>();
	let cols = $state(20);
	let rows = $state(12);
	let marcadores = $state.raw<Tracking.Marker[]>([]);
	let calibracao = $state.raw<Calibration.Calibration | null>(null);

	let detector: Tracking.Detector | undefined;
	let stream: MediaStream | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let captura: HTMLCanvasElement | undefined;

	const cantosVistos = $derived(CANTOS.map((cantoId) => marcadores.some((m) => m.id === cantoId)));
	const todosOsCantos = $derived(cantosVistos.every(Boolean));
	const tokens = $derived(
		marcadores
			.filter((m) => !CANTOS.includes(m.id))
			.map((m) => {
				if (!calibracao) return { id: m.id, ponto: null, celula: null };
				return {
					id: m.id,
					ponto: Calibration.project(calibracao, m.center),
					celula: Calibration.toCell(calibracao, m.center, cols, rows)
				};
			})
			.sort((a, b) => a.id - b.id)
	);

	function mensagem(erro: unknown) {
		if (erro instanceof DOMException) {
			if (erro.name === 'NotAllowedError') return 'A permissão da câmera foi negada.';
			if (erro.name === 'NotFoundError') return 'Nenhuma câmera foi encontrada.';
			if (erro.name === 'NotReadableError') return 'A câmera está em uso por outro programa.';
		}
		return 'Não foi possível iniciar a câmera. Tente de novo.';
	}

	async function iniciar() {
		if (!video) return;
		estado = 'iniciando';
		falha = undefined;
		try {
			const { TrackingOpenCv } = await import('@dnf/core/trackingopencv');
			detector = await TrackingOpenCv.create();
			stream = await navigator.mediaDevices.getUserMedia({
				video: { width: { ideal: 1280 }, height: { ideal: 720 } },
				audio: false
			});
			video.srcObject = stream;
			await video.play();
			estado = 'rodando';
			quadro();
		} catch (erro) {
			falha = mensagem(erro);
			parar();
		}
	}

	function parar() {
		clearTimeout(timer);
		stream?.getTracks().forEach((faixa) => faixa.stop());
		stream = undefined;
		detector?.dispose();
		detector = undefined;
		if (video) video.srcObject = null;
		marcadores = [];
		estado = 'parado';
	}

	function quadro() {
		if (estado !== 'rodando' || !video || !detector) return;
		const { videoWidth: largura, videoHeight: altura } = video;
		if (largura && altura) {
			captura ??= document.createElement('canvas');
			if (captura.width !== largura || captura.height !== altura) {
				captura.width = largura;
				captura.height = altura;
			}
			const contexto = captura.getContext('2d', { willReadFrequently: true })!;
			contexto.drawImage(video, 0, 0);
			const imagem = contexto.getImageData(0, 0, largura, altura);

			marcadores = detector.detect(imagem);
			// A câmera mudou de resolução: a calibração antiga não vale mais.
			if (calibracao && !Calibration.matches(calibracao, imagem)) calibracao = null;
			desenhar(largura, altura);
		}
		timer = setTimeout(quadro, INTERVALO_MS);
	}

	function desenhar(largura: number, altura: number) {
		if (!overlay) return;
		if (overlay.width !== largura || overlay.height !== altura) {
			overlay.width = largura;
			overlay.height = altura;
		}
		const contexto = overlay.getContext('2d')!;
		contexto.clearRect(0, 0, largura, altura);
		contexto.lineWidth = Math.max(2, largura / 400);
		contexto.font = `bold ${Math.round(largura / 40)}px sans-serif`;

		if (calibracao) {
			contexto.strokeStyle = '#f5c542';
			contexto.beginPath();
			calibracao.corners.forEach(([x, y], i) => (i === 0 ? contexto.moveTo(x, y) : contexto.lineTo(x, y)));
			contexto.closePath();
			contexto.stroke();
		}

		for (const marcador of marcadores) {
			const canto = CANTOS.includes(marcador.id);
			contexto.strokeStyle = canto ? '#f5c542' : '#4ade80';
			contexto.fillStyle = contexto.strokeStyle;
			contexto.beginPath();
			marcador.corners.forEach(([x, y], i) => (i === 0 ? contexto.moveTo(x, y) : contexto.lineTo(x, y)));
			contexto.closePath();
			contexto.stroke();

			const celula =
				calibracao && !canto
					? Calibration.toCell(calibracao, marcador.center, cols, rows)
					: null;
			const texto = celula ? `#${marcador.id}  ${celula.col},${celula.row}` : `#${marcador.id}`;
			contexto.fillText(texto, marcador.corners[0][0], marcador.corners[0][1] - 8);
		}
	}

	function calibrar() {
		if (!video) return;
		const nova = Calibration.fromMarkers(marcadores, CANTOS, {
			width: video.videoWidth,
			height: video.videoHeight
		});
		if (nova) {
			calibracao = nova;
			falha = undefined;
		} else {
			falha = 'Os 4 marcadores dos cantos precisam estar visíveis e formando um quadrilátero.';
		}
	}

	onDestroy(parar);
</script>

<header>
	<h1>Rastreio de tokens</h1>
	<p>Mostre os 4 marcadores dos cantos para a câmera, calibre e depois mova um marcador de teste.</p>
</header>

<div class="layout">
	<section class="palco" aria-label="Câmera">
		<div class="video">
			<!-- svelte-ignore a11y_media_has_caption -->
			<video bind:this={video} playsinline muted></video>
			<canvas bind:this={overlay}></canvas>
			{#if estado !== 'rodando'}
				<p class="parado">
					{estado === 'iniciando' ? 'Iniciando câmera e OpenCV…' : 'Câmera desligada.'}
				</p>
			{/if}
		</div>
		{#if falha}<p class="aviso" role="alert">{falha}</p>{/if}
	</section>

	<aside>
		<div class="bloco">
			{#if estado === 'rodando'}
				<button type="button" class="sec" onclick={parar}>Parar câmera</button>
			{:else}
				<button type="button" class="prim" onclick={iniciar} disabled={estado === 'iniciando'}>
					Ligar câmera
				</button>
			{/if}
		</div>

		<div class="bloco">
			<h2>Mesa</h2>
			<div class="campos">
				<label>Colunas <input type="number" min="1" max="200" bind:value={cols} /></label>
				<label>Linhas <input type="number" min="1" max="200" bind:value={rows} /></label>
			</div>
		</div>

		<div class="bloco">
			<h2>Calibração</h2>
			<ul class="cantos">
				{#each CANTOS as cantoId, i (cantoId)}
					<li class:visto={cantosVistos[i]}>#{cantoId} · {NOMES_CANTOS[i]}</li>
				{/each}
			</ul>
			<div class="acoes">
				<button type="button" class="prim" onclick={calibrar} disabled={!todosOsCantos}>
					{calibracao ? 'Calibrar de novo' : 'Calibrar'}
				</button>
				{#if calibracao}
					<button type="button" class="sec" onclick={() => (calibracao = null)}>Limpar</button>
				{/if}
			</div>
			<p class="estado">{calibracao ? 'Mesa calibrada.' : 'Sem calibração.'}</p>
		</div>

		<div class="bloco">
			<h2>Tokens</h2>
			{#if tokens.length === 0}
				<p class="estado">Nenhum token à vista.</p>
			{:else}
				<ul class="tokens">
					{#each tokens as token (token.id)}
						<li>
							<strong>#{token.id}</strong>
							<span>
								{#if !calibracao}calibre para ver a célula
								{:else if token.celula}coluna {token.celula.col}, linha {token.celula.row}
								{:else}fora da mesa{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}

			{#if calibracao}
				<svg viewBox="0 0 {cols} {rows}" role="img" aria-label="Posição dos tokens na mesa">
					<rect width={cols} height={rows} class="fundo" />
					{#each { length: cols - 1 } as _, i (i)}
						<line x1={i + 1} y1="0" x2={i + 1} y2={rows} />
					{/each}
					{#each { length: rows - 1 } as _, i (i)}
						<line x1="0" y1={i + 1} x2={cols} y2={i + 1} />
					{/each}
					{#each tokens as token (token.id)}
						{#if token.ponto && token.celula}
							<circle cx={token.ponto[0] * cols} cy={token.ponto[1] * rows} r="0.45" />
						{/if}
					{/each}
				</svg>
			{/if}
		</div>
	</aside>
</div>

<section class="folha">
	<h2>Marcadores</h2>
	<p>
		Cantos (#0 a #3) e tokens de teste. Mostre-os na tela de outro aparelho ou imprima; a câmera
		precisa ver cada um com pelo menos uns 30 px de lado.
	</p>
	<RastreioMarcadores ids={[...CANTOS, ...TOKENS_TESTE]} />
</section>

<style>
	header {
		margin-bottom: 1.5rem;
	}

	h1 {
		margin: 0;
		font-size: clamp(1.7rem, 3vw, 2.4rem);
		font-weight: 700;
		letter-spacing: -0.03em;
		text-align: left;
	}

	header p {
		margin: 0.2rem 0 0;
		color: rgb(255 255 255 / 0.6);
	}

	h2 {
		margin: 0 0 0.6rem;
		font-size: 1rem;
		font-weight: 700;
	}

	.layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.2rem;
		align-items: start;
	}

	.palco,
	.bloco,
	.folha {
		padding: 1.2rem;
		border: 1px solid rgb(255 255 255 / 0.12);
		border-radius: 1rem;
		background: rgb(255 255 255 / 0.04);
	}

	.palco {
		padding: 0.8rem;
	}

	.video {
		position: relative;
		aspect-ratio: 16 / 9;
		overflow: hidden;
		border-radius: 0.6rem;
		background: #000;
	}

	video,
	canvas {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.parado {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		color: rgb(255 255 255 / 0.6);
	}

	aside {
		display: grid;
		gap: 1rem;
	}

	.campos {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.6rem;
	}

	label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.85rem;
		color: rgb(255 255 255 / 0.7);
	}

	input {
		padding: 0.5rem 0.6rem;
		border: 1px solid rgb(255 255 255 / 0.2);
		border-radius: 0.5rem;
		background: rgb(255 255 255 / 0.06);
		color: #fff;
		font: inherit;
	}

	.cantos,
	.tokens {
		margin: 0 0 0.8rem;
		padding: 0;
		list-style: none;
		display: grid;
		gap: 0.3rem;
	}

	.cantos li {
		color: rgb(255 255 255 / 0.45);
	}

	.cantos li.visto {
		color: var(--gold);
	}

	.tokens li {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
	}

	.tokens span,
	.estado {
		color: rgb(255 255 255 / 0.65);
		font-size: 0.9rem;
	}

	.estado {
		margin: 0.6rem 0 0;
	}

	.acoes {
		display: flex;
		gap: 0.6rem;
	}

	button {
		padding: 0.65rem 1.2rem;
		border: 0;
		border-radius: 999px;
		font: inherit;
		font-weight: 700;
		cursor: pointer;
	}

	button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.prim {
		background: var(--gold);
		color: var(--on-gold);
	}

	.sec {
		background: rgb(255 255 255 / 0.12);
		color: #fff;
	}

	svg {
		display: block;
		width: 100%;
		margin-top: 0.4rem;
		border-radius: 0.4rem;
	}

	svg .fundo {
		fill: rgb(255 255 255 / 0.05);
		stroke: rgb(255 255 255 / 0.3);
		stroke-width: 0.06;
	}

	svg line {
		stroke: rgb(255 255 255 / 0.12);
		stroke-width: 0.03;
	}

	svg circle {
		fill: #4ade80;
	}

	.aviso {
		margin: 0.8rem 0 0;
		color: var(--danger);
	}

	.folha {
		margin-top: 1.2rem;
	}

	.folha p {
		margin: 0 0 1rem;
		color: rgb(255 255 255 / 0.6);
	}

	@media (min-width: 64rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 20rem;
		}
	}
</style>
