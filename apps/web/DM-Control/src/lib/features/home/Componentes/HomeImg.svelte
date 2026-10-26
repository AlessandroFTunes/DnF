<script lang="ts">
	import { asset } from '$app/paths';

	let {
		src,
		alt,
		width,
		height
	}: { src: string; alt: string; width: number; height: number } = $props();
</script>

<img src={asset(src)} {alt} {width} {height} loading="lazy" />

<style>
	img {
		display: block;
		width: min(15rem, 44%);
		height: auto;
		border: 1px solid rgb(245 197 66 / 0.3);
		border-radius: 1.2rem;
		box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.6);
	}
</style>
