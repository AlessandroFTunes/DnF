import { createContext, useEffect, useRef, useState } from 'react';

/** Duração da passagem de cor da ficha (vermelho → amarelo ao virar herói lendário). */
const BLEND_MS = 1600;

const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

/**
 * Segura a troca de tema enquanto algo cobre a ficha (a animação do d20): a cor só começa a mudar
 * quando a ficha volta a aparecer. A árvore chama `hold(true)` antes de salvar o nível e `hold(false)` ao fechar.
 */
export const ThemeHold = createContext<(held: boolean) => void>(() => {});

/** Valor de 0 a 1 que anda suavemente até `target` (parado enquanto `paused`). Começa já no alvo, sem animar. */
export function useBlend(target: number, paused: boolean): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    if (paused || current.current === target) return;
    const from = current.current;
    const began = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - began) / BLEND_MS);
      current.current = from + (target - from) * easeInOut(p);
      setValue(current.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, paused]);

  return value;
}
