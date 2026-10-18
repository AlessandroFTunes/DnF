import { featuresByLevel, isFightingStyleFeature, type SrdClassDetail, type SrdClassFeature } from '@dnf/sdk/srd';
import { subclassOrigin } from '../../character-create/labels';
import { tr } from '../../../lib/srd';
import { NEBULAE, SKY } from './sky';
import type { TreeNode } from './Tree';

export interface StarData {
  id: string;
  /** Nome traduzido (o que aparece na estrela). */
  name: string;
  /** Nome original, mostrado na descrição quando difere do nome exibido. */
  original: string | null;
  level: number;
  levels: number[];
  desc: string;
  /** `hp`: estrela dos PV do próximo nível (só aparece subindo de nível). */
  kind: 'feature' | 'asi' | 'subclass' | 'hp';
  /** Característica com escolha feita na própria estrela. */
  choice?: 'fightingStyle';
}

/** Ramificação de uma subclasse que sai do tronco da classe. */
export interface Branch {
  sub: SrdClassDetail;
  color: string;
  stars: StarData[];
}

export interface TreeEntry {
  star: StarData;
  branch: Branch | null;
}

/** Nome + origem: livro fora do Livro do Jogador e/ou subclasse trazida da outra edição ("Chaplain · TOH · regras de 2014"). */
export const subclassLabel = (s: SrdClassDetail) => [tr.name(s), subclassOrigin(s)].filter(Boolean).join(' · ');

/** Uma estrela por habilidade (no primeiro nível em que aparece); ASI vira uma estrela por nível. */
export function starsOf(cls: SrdClassDetail, asiLevels: number[], subclassAt: number | null): StarData[] {
  const firstLevel = new Map<string, { feature: SrdClassFeature; levels: number[] }>();
  for (const [level, features] of featuresByLevel(cls)) {
    for (const f of features) {
      const entry = firstLevel.get(f.key) ?? { feature: f, levels: [] };
      entry.levels.push(level);
      firstLevel.set(f.key, entry);
    }
  }
  const stars: StarData[] = [...firstLevel.values()]
    // A característica "Subclasse de X" vira a estrela de onde saem as ramificações das subclasses.
    .filter(({ feature }) => subclassAt === null || !/^subclasse/i.test(feature.name))
    .map(({ feature, levels }) => {
      const sorted = levels.sort((a, b) => a - b);
      const name = tr.name(feature);
      // Subclasse de 2014 numa classe de 2024: avisa o nível original da habilidade.
      const note = feature.gained_at?.find((g) => g.detail?.startsWith('originalmente'))?.detail;
      return {
        id: feature.key,
        name,
        original: name !== feature.name ? feature.name : null,
        level: sorted[0]!,
        levels: sorted,
        desc: note ? `(${note}) ${tr.desc(feature)}` : tr.desc(feature),
        kind: 'feature' as const,
        ...(isFightingStyleFeature(feature.name) ? { choice: 'fightingStyle' as const } : {}),
      };
    });
  for (const level of asiLevels) {
    stars.push({
      id: `asi-${level}`,
      name: 'Atributos +',
      original: 'Aumento no Valor de Atributo',
      level,
      levels: [level],
      desc: '+2 em um atributo ou +1 em dois (máximo 20). Na edição 2024, também pode trocar por um talento.',
      kind: 'asi',
    });
  }
  if (subclassAt !== null) {
    stars.push({
      id: 'subclass',
      name: 'Subclasse',
      original: null,
      level: subclassAt,
      levels: [subclassAt],
      desc: 'Escolha a especialização da sua classe: cada ramificação que sai daqui é uma subclasse.',
      kind: 'subclass',
    });
  }
  return stars.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

export const branchesOf = (subclasses: SrdClassDetail[]): Branch[] =>
  subclasses.map((sub, i) => ({
    sub,
    color: NEBULAE[1 + (i % (NEBULAE.length - 1))]![1]!,
    stars: starsOf(sub, [], null),
  }));

/**
 * Monta o array da árvore: o tronco da classe sobe do nível 1 ao 20 e, no nível da subclasse, se abre numa
 * ramificação por subclasse. Escolhida (e salva) a subclasse, só a ramificação dela fica; escolhendo na
 * subida, todas continuam à mostra (dá para mudar de ideia até confirmar).
 */
export function buildNodes({
  trunk,
  branches,
  level,
  chosenKey,
  choosing,
  glowing,
}: {
  trunk: StarData[];
  branches: Branch[];
  level: number;
  chosenKey: string | null;
  choosing: boolean;
  glowing: Set<string>;
}): TreeNode[] {
  const chosen = choosing ? null : (branches.find((b) => b.sub.key === chosenKey) ?? null);
  const visible = chosen ? [chosen] : branches;

  // Estrelas do mesmo nível: uma em cada espaço, subindo (a bifurcação da subclasse fica por cima).
  const column = (
    stars: StarData[],
    x: number,
    branch: Branch | null,
    lit: (s: StarData) => boolean,
    root: string | null,
  ): TreeNode[] => {
    const ordered = [...stars].sort((a, b) => a.level - b.level || Number(a.kind === 'subclass') - Number(b.kind === 'subclass'));
    return ordered.map((star, i) => {
      const tint = branch ? branch.color : star.kind === 'asi' ? SKY.asi : star.kind === 'subclass' ? SKY.sub : SKY.star;
      return {
        id: star.id,
        level: star.level,
        slot: ordered.filter((s) => s.level === star.level).indexOf(star),
        column: x,
        from: i === 0 ? root : ordered[i - 1]!.id,
        color: tint,
        labelColor: star.kind === 'feature' && !branch ? SKY.text : tint,
        haloColor: branch ? branch.color : SKY.glow,
        lineColor: branch ? branch.color : SKY.line,
        // Sem subclasse escolhida, as ramificações ficam só com as estrelas (o nome aparece ao tocar).
        label: branch && !chosen ? null : star.name,
        labelSide: branch ? 'right' : 'left',
        lit: lit(star),
        glowing: glowing.has(star.id) || (choosing && !!branch && i === 0),
        accessibilityLabel: `${branch ? `${tr.name(branch.sub)}: ` : ''}${star.name}, nível ${star.level}${lit(star) ? ', desbloqueada' : ''}`,
      };
    });
  };

  // Tronco à esquerda do centro (nomes à esquerda dele); as ramificações à direita.
  const trunkNodes = column(trunk, branches.length ? 0.42 : 0.5, null, (s) => s.level <= level, null);
  const fork = trunkNodes.find((n) => n.id === 'subclass')?.id ?? null;
  const branchNodes = visible.flatMap((b, k) => {
    const n = visible.length;
    const x = chosen ? 0.62 : 0.6 + (n === 1 ? 0.15 : (k / (n - 1)) * 0.33);
    return column(b.stars, x, b, (s) => !!chosen && s.level <= level, fork);
  });
  return [...trunkNodes, ...branchNodes];
}
