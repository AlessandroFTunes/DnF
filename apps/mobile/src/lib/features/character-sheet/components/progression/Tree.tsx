import { memo, useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { spacing } from '@dnf/ui-react-native';
import { Line } from './Line';
import { Point } from './Point';
import { MAX_LEVEL, NEBULAE, seeded } from './sky';

/** Um item do array da árvore: define a estrela e (por `from`) a linha que chega nela. */
export interface TreeNode {
  id: string;
  /** Andar da árvore (1 embaixo, 20 em cima). */
  level: number;
  /** Posição no andar quando há várias estrelas no mesmo nível e coluna (0 = mais embaixo). */
  slot: number;
  /** Coluna, de 0 (esquerda) a 1 (direita). */
  column: number;
  /** Estrela de onde sai a linha até esta. */
  from: string | null;
  color: string;
  labelColor: string;
  haloColor: string;
  /** Cor da linha que chega nesta estrela. */
  lineColor: string;
  label: string | null;
  labelSide: 'left' | 'right';
  lit: boolean;
  glowing: boolean;
  accessibilityLabel: string;
}

const PADDING = 46;
/** Espaço vertical de cada estrela (cabe um nome em duas linhas sem encostar no vizinho). */
const SLOT = 42;
/** Folga entre um nível e o próximo; nível sem nada ocupa só `EMPTY_LEVEL`. */
const LEVEL_GAP = 16;
const EMPTY_LEVEL = 10;
const CARD_WIDTH = 300;
/** Altura máxima do painel da estrela (a descrição rola dentro dele). */
const CARD_HEIGHT = 300;
/** Altura da faixa dos botões de subir/confirmar nível. */
const ACTION_ROW = 92;

interface Positioned extends TreeNode {
  x: number;
  y: number;
}

/**
 * Árvore genérica: recebe o array de nós, calcula onde fica cada um e desenha `Line`s e `Point`s.
 * Não sabe nada de classe ou subida de nível.
 */
export function Tree({
  width,
  nodes,
  selectedId,
  onSelect,
  action,
  popover,
}: {
  width: number;
  nodes: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Faixa (botões de subir/confirmar) aberta logo abaixo de `beforeLevel`, sem cobrir estrela nenhuma. */
  action?: { beforeLevel: number; content: ReactNode } | null;
  /** Painel da estrela selecionada, posicionado ao lado dela. */
  popover?: ReactNode;
}) {
  const layout = useMemo(() => place(nodes, width, action?.beforeLevel ?? null), [nodes, width, action?.beforeLevel]);
  const { height, positioned, byId, actionTop } = layout;
  const selected = selectedId ? byId.get(selectedId) : undefined;

  const cardWidth = Math.min(CARD_WIDTH, width - 16);
  const cardPosition = selected && {
    left: Math.max(8, Math.min(width - cardWidth - 8, selected.x - cardWidth / 2)),
    ...cardVertical(selected.y, height, actionTop),
  };

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Sky width={width} height={height} />
        {positioned.map((n) => {
          const prev = n.from ? byId.get(n.from) : undefined;
          return prev ? (
            <Line key={`l-${n.id}`} x1={prev.x} y1={prev.y} x2={n.x} y2={n.y} color={n.lineColor} lit={prev.lit && n.lit} />
          ) : null;
        })}
      </Svg>

      {positioned.map((n) => (
        <Point
          key={n.id}
          id={n.id}
          x={n.x}
          y={n.y}
          color={n.color}
          labelColor={n.labelColor}
          haloColor={n.haloColor}
          label={n.label}
          labelSide={n.labelSide}
          lit={n.lit}
          glowing={n.glowing}
          selected={n.id === selectedId}
          treeWidth={width}
          accessibilityLabel={n.accessibilityLabel}
          onSelect={onSelect}
        />
      ))}

      {action && actionTop !== null && (
        <View style={[styles.actionRow, { top: actionTop, height: ACTION_ROW, pointerEvents: 'box-none' }]}>
          <View style={[styles.frontier, { pointerEvents: 'none' }]} />
          {action.content}
        </View>
      )}

      {cardPosition && popover ? <View style={[styles.cardAnchor, { width: cardWidth }, cardPosition]}>{popover}</View> : null}
    </View>
  );
}

/** Cada nível tem a altura do seu maior grupo de estrelas, de baixo para cima. */
function place(nodes: TreeNode[], width: number, actionBefore: number | null) {
  const slotsAt = new Map<number, number>();
  for (const n of nodes) slotsAt.set(n.level, Math.max(slotsAt.get(n.level) ?? 0, n.slot + 1));

  const levelBase = new Map<number, number>();
  let offset = 0;
  let actionCenter: number | null = null;
  for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
    if (lvl === actionBefore) {
      actionCenter = offset + ACTION_ROW / 2;
      offset += ACTION_ROW;
    }
    levelBase.set(lvl, offset);
    const slots = slotsAt.get(lvl) ?? 0;
    offset += slots ? slots * SLOT + LEVEL_GAP : EMPTY_LEVEL;
  }
  const height = PADDING * 2 + offset;

  const positioned: Positioned[] = nodes.map((n) => ({
    ...n,
    x: width * n.column + (seeded(n.id, 1) - 0.5) * 12,
    y: height - PADDING - (levelBase.get(n.level) ?? 0) - n.slot * SLOT,
  }));
  return {
    height,
    positioned,
    byId: new Map(positioned.map((p) => [p.id, p])),
    actionTop: actionCenter === null ? null : height - PADDING - actionCenter - ACTION_ROW / 2,
  };
}

/**
 * Painel ao lado da estrela: abaixo dela na metade de cima da árvore, acima na metade de baixo, mas sem
 * nunca cobrir a faixa dos botões (vira para o outro lado ou passa por baixo dela).
 */
function cardVertical(y: number, height: number, rowTop: number | null): { top: number } | { bottom: number } {
  const below = { top: y + 22 };
  const above = { bottom: height - y + 22 };
  if (rowTop === null) return y < height / 2 ? below : above;
  const rowBottom = rowTop + ACTION_ROW;
  const fitsAbove = y - 22 - CARD_HEIGHT > 0 && (y < rowTop || y - 22 - CARD_HEIGHT > rowBottom);
  const fitsBelow = y + 22 + CARD_HEIGHT < height && (y > rowBottom || y + 22 + CARD_HEIGHT < rowTop);
  if (y < height / 2 ? fitsBelow : !fitsAbove && fitsBelow) return below;
  if (fitsAbove) return above;
  // Sem espaço dos dois lados: abre logo depois da faixa, do lado da estrela.
  return y < rowTop ? { bottom: height - rowTop + 8 } : { top: rowBottom + 8 };
}

/** Fundo: nebulosas e estrelas soltas (só redesenha quando o tamanho muda). */
const Sky = memo(function Sky({ width, height }: { width: number; height: number }) {
  const palette = NEBULAE[0]!;
  const stars = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        x: seeded('tree-bg', i) * width,
        y: seeded('tree-bg', i + 100) * height,
        r: 0.4 + seeded('tree-bg', i + 200) * 1.1,
        o: 0.2 + seeded('tree-bg', i + 300) * 0.7,
      })),
    [width, height],
  );
  return (
    <>
      <Defs>
        {palette.map((color, i) => (
          <RadialGradient key={i} id={`tree-neb-${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.5} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {palette.map((_, i) => (
        <Ellipse
          key={i}
          cx={width * (0.25 + seeded('tree', 10 + i) * 0.5)}
          cy={height * (0.15 + i * 0.32)}
          rx={width * (0.4 + seeded('tree', 30 + i) * 0.3)}
          ry={height * 0.18}
          fill={`url(#tree-neb-${i})`}
        />
      ))}
      {stars.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  cardAnchor: { position: 'absolute' },
  actionRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  /** Linha tracejada da "fronteira" entre o que já tem e o próximo nível. */
  frontier: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '50%',
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,230,176,0.3)',
  },
});
