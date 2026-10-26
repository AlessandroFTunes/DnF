<script lang="ts">
	import { nebula } from '../animation/nebula';
	import '../animation/twinkle.css';
</script>

<div class="sky" aria-hidden="true">
	<canvas {@attach nebula}></canvas>
	<div class="stars-near"></div>
	<div class="stars-far"></div>
</div>

<style>
	.sky,
	canvas,
	.stars-near,
	.stars-far {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	canvas {
		filter: blur(36px) saturate(1.2);
		opacity: 0.6;
	}

	/* Estrelas: duas camadas de pontos em tamanhos e espaçamentos diferentes */
	.stars-near {
		background-image:
			radial-gradient(1px 1px at 20px 30px, #fff, transparent),
			radial-gradient(1px 1px at 90px 120px, #cfe8ff, transparent),
			radial-gradient(1.5px 1.5px at 160px 70px, #fff, transparent),
			radial-gradient(1px 1px at 230px 180px, #ffe9c4, transparent),
			radial-gradient(1px 1px at 300px 20px, #fff, transparent);
		background-size: 340px 220px;
		opacity: 0.8;
	}

	.stars-far {
		background-image:
			radial-gradient(2px 2px at 60px 90px, #fff, transparent),
			radial-gradient(2px 2px at 310px 250px, #cfe8ff, transparent),
			radial-gradient(1.5px 1.5px at 180px 330px, #fff, transparent);
		background-size: 470px 380px;
		animation: twinkle 5s ease-in-out infinite alternate;
	}
</style>
