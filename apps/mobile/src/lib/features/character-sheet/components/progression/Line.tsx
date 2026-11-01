import { memo } from 'react';
import { Line as SvgLine } from 'react-native-svg';
import { SKY } from './sky';

export interface LineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  /** As duas pontas desbloqueadas: a linha acende na cor da constelação. */
  lit: boolean;
}

/** Ligação entre duas estrelas (desenhada dentro do `Svg` da árvore). */
export const Line = memo(function Line({ x1, y1, x2, y2, color, lit }: LineProps) {
  return (
    <SvgLine
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={lit ? color : SKY.locked}
      strokeOpacity={lit ? 0.85 : 0.35}
      strokeWidth={lit ? 1.6 : 1}
    />
  );
});
