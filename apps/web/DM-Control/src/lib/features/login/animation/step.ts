import { fade, fly } from 'svelte/transition';

/** Entrada e saída das etapas do login: deslizam de lado e esmaecem. */
export const stepIn = (_node: Element) => fly(_node, { x: 24, duration: 260, delay: 160 });
export const stepOut = (_node: Element) => fade(_node, { duration: 140 });
