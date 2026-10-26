import type { Attachment } from 'svelte/attachments';

// Faixas de luz que ondulam devagar, somadas com 'lighter' para formar a nebulosa.
const bands = [
	{ color: '150,90,240', base: 0.3, amp: 0.09, freq: 1.4, speed: 0.22, phase: 0, height: 0.28 },
	{ color: '110,60,210', base: 0.5, amp: 0.11, freq: 1.0, speed: -0.16, phase: 2, height: 0.34 },
	{ color: '170,120,255', base: 0.68, amp: 0.1, freq: 1.7, speed: 0.12, phase: 4, height: 0.3 },
	{ color: '200,160,255', base: 0.4, amp: 0.07, freq: 2.3, speed: -0.28, phase: 1, height: 0.16 },
	{ color: '90,70,220', base: 0.82, amp: 0.08, freq: 1.2, speed: 0.18, phase: 5, height: 0.26 }
];

/** Desenha a nebulosa animada no canvas. Uso: `<canvas {@attach nebula}>`. */
export const nebula: Attachment<HTMLCanvasElement> = (canvas) => {
	const ctx = canvas.getContext('2d');
	if (!ctx) return;
	const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
	let width = 0;
	let height = 0;
	let frame = 0;

	const resize = () => {
		const dpr = Math.min(devicePixelRatio || 1, 2);
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = width * dpr;
		canvas.height = height * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	};

	const draw = (ms: number) => {
		const t = ms / 1000;
		ctx.clearRect(0, 0, width, height);
		ctx.globalCompositeOperation = 'lighter';
		for (const b of bands) {
			const wave = (x: number) => {
				const u = (x / width) * Math.PI * 2 * b.freq + t * b.speed * 2 + b.phase;
				const y = b.base + Math.sin(u) * b.amp + Math.sin(u * 0.5 + t * 0.1) * b.amp * 0.6;
				return y * height;
			};
			const thickness = b.height * height;
			const top = (b.base - b.amp) * height - thickness * 0.2;
			const grad = ctx.createLinearGradient(0, top, 0, top + thickness * 2);
			grad.addColorStop(0, `rgba(${b.color},0)`);
			grad.addColorStop(0.5, `rgba(${b.color},0.22)`);
			grad.addColorStop(1, `rgba(${b.color},0)`);
			ctx.fillStyle = grad;
			ctx.beginPath();
			ctx.moveTo(0, wave(0));
			for (let x = 0; x <= width + 12; x += 12) ctx.lineTo(x, wave(x));
			for (let x = width + 12; x >= 0; x -= 12) ctx.lineTo(x, wave(x) + thickness);
			ctx.closePath();
			ctx.fill();
		}
	};

	const loop = (ms: number) => {
		draw(ms);
		frame = requestAnimationFrame(loop);
	};

	resize();
	addEventListener('resize', resize);
	if (reduced) draw(8000);
	else frame = requestAnimationFrame(loop);

	return () => {
		cancelAnimationFrame(frame);
		removeEventListener('resize', resize);
	};
};
