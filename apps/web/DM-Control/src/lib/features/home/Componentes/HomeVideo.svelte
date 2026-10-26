<script lang="ts">
	let { src, poster, label }: { src: string; poster: string; label: string } = $props();

	let video: HTMLVideoElement;
	let playing = $state(false);
	let progress = $state(0);

	function toggle() {
		if (video.paused) video.play().catch(() => {});
		else video.pause();
	}
</script>

<div class="player">
	<video
		bind:this={video}
		{src}
		{poster}
		aria-label={label}
		muted
		loop
		playsinline
		preload="metadata"
		onplay={() => (playing = true)}
		onpause={() => (playing = false)}
		ontimeupdate={() => (progress = video.currentTime / video.duration || 0)}
	></video>
	<button
		type="button"
		class="play"
		class:playing
		aria-label={playing ? 'Pausar demonstração' : 'Ver demonstração'}
		onclick={toggle}
	>
		<svg viewBox="0 0 24 24" aria-hidden="true">
			{#if playing}
				<path d="M7 5h4v14H7zM13 5h4v14h-4z" />
			{:else}
				<path d="M8 5v14l11-7z" />
			{/if}
		</svg>
	</button>
	<div class="progress" class:playing aria-hidden="true">
		<span style:width="{progress * 100}%"></span>
	</div>
</div>

<style>
	.player {
		--gold: #f5c542;

		position: relative;
		width: min(15rem, 44%);
	}

	video {
		display: block;
		width: 100%;
		height: auto;
		border: 1px solid rgb(245 197 66 / 0.3);
		border-radius: 1.2rem;
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.6);
	}

	.play {
		position: absolute;
		top: 50%;
		left: 50%;
		display: grid;
		place-items: center;
		width: 4rem;
		height: 4rem;
		padding: 0;
		border: 1px solid var(--gold);
		border-radius: 50%;
		background: rgb(2 3 10 / 0.7);
		color: var(--gold);
		cursor: pointer;
		transform: translate(-50%, -50%);
		backdrop-filter: blur(4px);
		transition:
			opacity 0.2s,
			transform 0.15s;
	}

	.play:hover {
		transform: translate(-50%, -50%) scale(1.08);
	}

	.play svg {
		width: 1.8rem;
		height: 1.8rem;
		margin-left: 0.2rem;
		fill: currentColor;
	}

	/* Tocando: o botão vira um "pausar" pequeno no canto. */
	.play.playing {
		top: auto;
		left: auto;
		right: 0.75rem;
		bottom: 1rem;
		width: 2.5rem;
		height: 2.5rem;
		transform: none;
	}

	.play.playing:hover {
		transform: scale(1.08);
	}

	.play.playing svg {
		width: 1.2rem;
		height: 1.2rem;
		margin-left: 0;
	}

	.progress {
		position: absolute;
		right: 1px;
		bottom: 1px;
		left: 1px;
		height: 3px;
		overflow: hidden;
		border-radius: 0 0 1.2rem 1.2rem;
		background: rgb(255 255 255 / 0.15);
		opacity: 0;
		transition: opacity 0.2s;
	}

	.progress.playing {
		opacity: 1;
	}

	.progress span {
		display: block;
		height: 100%;
		background: var(--gold);
	}
</style>
