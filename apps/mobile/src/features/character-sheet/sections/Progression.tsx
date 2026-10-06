import { useContext, useEffect, useState, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, RadialGradient, Stop } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES, abilityModifier, type Ability } from '@dnf/core/character';
import { abilityIncreaseOf, featHitPointsPerLevel, featuresByLevel, plainText, type SrdClassDetail, type SrdClassFeature } from '@dnf/sdk/srd';
import { Button, Chip, fonts, formatBonus, radius, spacing, textGlow } from '@dnf/ui-react-native';
import { ABILITY_LABEL, subclassOrigin } from '../../character-create/labels';
import { LevelUpCelebration, type LevelUpGain } from '../LevelUpCelebration';
import { ThemeHold } from '../themeBlend';
import type { Sheet, SheetData } from '../useSheet';
import { tr } from '../../../lib/srd';

/** A árvore é sempre noturna (céu estilo Skyrim), nos dois temas. */
const SKY = {
  bg: '#07080F',
  star: '#FFE6B0',
  glow: '#FFB45C',
  locked: '#6E7090',
  line: '#FFD9A0',
  text: '#F3EBDD',
  muted: '#9AA0BE',
  sub: '#C9B3FF',
  asi: '#9CCBFF',
};

/** Paleta da nebulosa de cada constelação (classe = brasa, subclasses = tons frios). */
const NEBULAE = [
  ['#B4361A', '#E8822E', '#5A1A3A'],
  ['#4B2A8C', '#8F4BC9', '#1B3A73'],
  ['#1E5A7A', '#3FA3B8', '#2C1F5E'],
  ['#7A1F4D', '#C2477E', '#2E1A55'],
  ['#2F6B3A', '#7FB86A', '#173445'],
];

const MAX_LEVEL = 20;

/** Nome + origem: livro fora do Livro do Jogador e/ou subclasse trazida da outra edição ("Chaplain · TOH · regras de 2014"). */
const subclassLabel = (s: SrdClassDetail) => [tr.name(s), subclassOrigin(s)].filter(Boolean).join(' · ');

/** Número pseudoaleatório estável a partir de um texto (posições sempre iguais). */
function seeded(text: string, n: number): number {
  let h = 2166136261;
  for (const ch of `${text}:${n}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

interface StarData {
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
}

/** Uma estrela por habilidade (no primeiro nível em que aparece); ASI vira uma estrela por nível. */
function starsOf(cls: SrdClassDetail, asiLevels: number[], subclassAt: number | null): StarData[] {
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
        kind: 'feature',
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


export function Progression({ sheet }: { sheet: Sheet }) {
  const { character, derived } = sheet;
  if (!character || !derived) return null;
  return <ProgressionView sheet={sheet} derived={derived} />;
}

/** Ramificação de uma subclasse que sai do tronco da classe. */
interface Branch {
  sub: SrdClassDetail;
  color: string;
  stars: StarData[];
}

interface TreeEntry {
  star: StarData;
  branch: Branch | null;
}

/**
 * Árvore de evolução. Subir de nível acontece nela mesma: as estrelas do próximo nível brilham e as escolhas
 * (PV, atributo, subclasse) são feitas tocando nelas.
 */
function ProgressionView({ sheet, derived }: { sheet: Sheet; derived: SheetData }) {
  const character = sheet.character!;
  const { isOwner } = sheet;
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(windowWidth - 32, 820));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const holdTheme = useContext(ThemeHold);
  const [celebration, setCelebration] = useState<{ level: number; gains: LevelUpGain[] } | null>(null);
  // Depois de subir: as habilidades do nível novo brilham até o jogador tocar nelas.
  const [fresh, setFresh] = useState<{ level: number; seen: string[] } | null>(null);

  // Subida de nível (escolhas feitas nas estrelas; só vale ao confirmar).
  const [levelingUp, setLevelingUp] = useState(false);
  const [pendingSubclass, setPendingSubclass] = useState<string | null>(null);
  const [hpMode, setHpMode] = useState<'average' | 'roll'>('average');
  const [rolled, setRolled] = useState<number | null>(null);
  const [asiMode, setAsiMode] = useState<'two' | 'oneOne'>('two');
  const [asiPicks, setAsiPicks] = useState<Ability[]>([]);
  const [saving, setSaving] = useState(false);

  const level = character.level;
  const next = level + 1;
  const hasSubclasses = derived.subclasses.length > 0;

  const conMod = abilityModifier(derived.scores.con);
  const extraHp = (derived.species?.hpPerLevel ?? 0) + featHitPointsPerLevel(derived.feats);
  const average = Math.floor(derived.hitDie / 2) + 1;
  const die = hpMode === 'average' ? average : rolled;
  const gain = die === null ? null : Math.max(1, die + conMod + extraHp);

  const choosing = levelingUp && !derived.subclass && next >= derived.subclassLevel && hasSubclasses;
  const isAsi = levelingUp && derived.asiLevels.includes(next);
  const asiDone = !isAsi || asiPicks.length === (asiMode === 'two' ? 1 : 2);
  const missing = [
    ...(choosing && !pendingSubclass ? ['a subclasse'] : []),
    ...(isAsi && !asiDone ? ['o aumento de atributo'] : []),
    ...(gain === null ? ['os pontos de vida'] : []),
  ];
  const ready = levelingUp && missing.length === 0;

  const hpStar: StarData = {
    id: 'hp-next',
    name: gain === null ? 'Pontos de vida' : `+${gain} PV`,
    original: null,
    level: next,
    levels: [next],
    desc: `Seus PV máximos aumentam: a média do d${derived.hitDie} (${average}) ou uma rolagem, ${formatBonus(conMod)} de Constituição${extraHp ? ` e +${extraHp} de traços/talentos` : ''}.`,
    kind: 'hp',
  };
  const trunk = [
    ...starsOf(derived.cls, derived.asiLevels, hasSubclasses ? derived.subclassLevel : null),
    ...(levelingUp ? [hpStar] : []),
  ];
  const branches: Branch[] = derived.subclasses.map((sub, i) => ({
    sub,
    color: NEBULAE[1 + (i % (NEBULAE.length - 1))]![1]!,
    stars: starsOf(sub, [], null),
  }));
  const chosenKey = derived.subclass?.key ?? (levelingUp ? pendingSubclass : null);
  const inPath = (branch: Branch | null) => !branch || branch.sub.key === chosenKey;

  const entries: TreeEntry[] = [
    ...trunk.map((star) => ({ star, branch: null })),
    ...branches.flatMap((branch) => branch.stars.map((star) => ({ star, branch }))),
  ];
  const selected = entries.find((e) => e.star.id === selectedId) ?? null;

  // O que brilha: subindo, o que o próximo nível dá; depois de subir, o que acabou de ganhar.
  const glowing = new Set(
    entries
      .filter(({ branch }) => inPath(branch))
      .filter(({ star }) =>
        levelingUp ? star.level === next : fresh ? star.level === fresh.level && !fresh.seen.includes(star.id) : false,
      )
      .map(({ star }) => star.id),
  );

  const select = (id: string) => {
    setSelectedId((current) => (current === id ? null : id));
    if (fresh && !fresh.seen.includes(id)) setFresh({ ...fresh, seen: [...fresh.seen, id] });
  };

  const resetLevelUp = () => {
    setLevelingUp(false);
    setPendingSubclass(null);
    setHpMode('average');
    setRolled(null);
    setAsiMode('two');
    setAsiPicks([]);
    setSelectedId(null);
  };

  function toggleAsi(a: Ability) {
    const max = asiMode === 'two' ? 1 : 2;
    setAsiPicks((p) => (p.includes(a) ? p.filter((x) => x !== a) : p.length < max ? [...p, a] : p));
  }

  async function confirm() {
    if (!ready || gain === null) return;
    setSaving(true);
    // A cor da ficha (se virar lendário) só muda depois que a animação do d20 fechar.
    holdTheme(true);
    const abilities = { ...character.abilities };
    if (isAsi) for (const a of asiPicks) abilities[a] = Math.min(20, abilities[a] + (asiMode === 'two' ? 2 : 1));
    const current = character.classes[0]!;
    const chosenSub = derived.subclasses.find((s) => s.key === pendingSubclass);
    const saved = await sheet.save({
      classes: [{ ...current, level: next, subclassKey: pendingSubclass ?? current.subclassKey }],
      abilities,
      combat: { hpMax: character.combat.hpMax + gain, hpCurrent: character.combat.hpCurrent + gain },
    });
    setSaving(false);
    if (!saved) {
      // A ficha voltou ao nível anterior; as escolhas ficam para tentar de novo.
      holdTheme(false);
      return;
    }

    const subclass = chosenSub ?? derived.subclass;
    const newFeatures = [
      ...(featuresByLevel(derived.cls).get(next) ?? []),
      ...((subclass ? featuresByLevel(subclass).get(next) : undefined) ?? []),
      // Com a subclasse escolhida agora, ela aparece pelo nome no lugar de "Subclasse de X".
    ].filter((f: SrdClassFeature) => !(chosenSub && /^subclasse/i.test(f.name)));
    const gains: LevelUpGain[] = [
      ...(chosenSub ? [{ label: tr.name(chosenSub), kind: 'subclass' as const }] : []),
      ...newFeatures.map((f) => ({ label: tr.name(f), kind: 'feature' as const })),
      // Característica que aumenta atributos (Campeão Primitivo: +4 FOR e CON) aparece também como aumento.
      ...newFeatures.flatMap((f) => {
        const increase = abilityIncreaseOf(f.desc);
        return increase
          ? increase.abilities.map((a) => ({ label: `+${increase.amount} ${ABILITY_LABEL[a].name}`, kind: 'asi' as const }))
          : [];
      }),
      ...(isAsi ? asiPicks.map((a) => ({ label: `+${asiMode === 'two' ? 2 : 1} ${ABILITY_LABEL[a].name}`, kind: 'asi' as const })) : []),
      { label: `+${gain} pontos de vida máximos`, kind: 'hp' },
    ];
    resetLevelUp();
    setCelebration({ level: next, gains });
    setFresh({ level: next, seen: [] });
  }

  const hint = levelingUp
    ? missing.length
      ? `Nível ${next}: toque nas estrelas brilhando para escolher ${missing.join(' e ')}.`
      : `Tudo escolhido. Confirme o nível ${next}.`
    : glowing.size > 0
      ? 'As estrelas brilhando são suas novas habilidades. Toque para ler.'
      : derived.subclassesLoading
        ? 'Carregando as subclasses…'
        : 'Toque numa estrela para ler a habilidade.';

  return (
    <View style={styles.column}>
      <View style={styles.sky} onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
        <View style={styles.header}>
          <View style={styles.legendary}>
            <Text style={styles.legendaryText}>
              {tr.name(derived.cls).toUpperCase()} · NÍVEL {levelingUp ? `${level} → ${next}` : level}
            </Text>
          </View>
        </View>
        {derived.subclass && <Text style={styles.subclassName}>{subclassLabel(derived.subclass)}</Text>}
        {!levelingUp && <Text style={styles.hint}>{hint}</Text>}

        <SkillTree
          width={width}
          level={level}
          trunk={trunk}
          branches={branches}
          chosenKey={chosenKey}
          choosing={choosing}
          glowing={glowing}
          selectedId={selectedId}
          onSelect={select}
          levelAction={
            isOwner && level < MAX_LEVEL ? (
              levelingUp ? (
                <View style={styles.action}>
                  <View style={styles.actionButtons}>
                    <Pressable onPress={resetLevelUp} accessibilityRole="button" style={styles.actionSecondary}>
                      <MaterialCommunityIcons name="close" size={16} color={SKY.muted} />
                      <Text style={styles.actionSecondaryText}>Cancelar</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void confirm()}
                      disabled={!ready || saving}
                      accessibilityRole="button"
                      accessibilityLabel={`Confirmar nível ${next}`}
                      style={[styles.actionPrimary, { opacity: !ready || saving ? 0.45 : 1 }]}
                    >
                      <MaterialCommunityIcons name="check-bold" size={16} color={SKY.bg} />
                      <Text style={styles.actionPrimaryText}>{saving ? 'Salvando…' : `Confirmar nível ${next}`}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.actionHint}>{hint}</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => setLevelingUp(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Subir para o nível ${next}`}
                  style={styles.actionGhost}
                >
                  <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={18} color={SKY.star} />
                  <Text style={styles.actionGhostText}>Subir para o nível {next}</Text>
                </Pressable>
              )
            ) : null
          }
          popover={
            selected && (
              <StarCard
                entry={selected}
                unlocked={selected.star.level <= level && (!selected.branch || selected.branch.sub.key === derived.subclass?.key)}
                onClose={() => setSelectedId(null)}
              >
                {selected.star.kind === 'hp' && (
                  <View style={styles.chips}>
                    <Chip label={`Média: ${average}`} selected={hpMode === 'average'} onPress={() => setHpMode('average')} />
                    <Chip
                      label={rolled === null ? `Rolar d${derived.hitDie}` : `Rolou ${rolled} (de novo)`}
                      selected={hpMode === 'roll'}
                      onPress={() => {
                        setHpMode('roll');
                        setRolled(1 + Math.floor(Math.random() * derived.hitDie));
                      }}
                      icon={(c) => <MaterialCommunityIcons name="dice-d20-outline" size={14} color={c} />}
                    />
                  </View>
                )}
                {selected.star.kind === 'asi' && isAsi && selected.star.level === next && (
                  <>
                    <View style={styles.chips}>
                      <Chip label="+2 em um" selected={asiMode === 'two'} onPress={() => (setAsiMode('two'), setAsiPicks([]))} />
                      <Chip label="+1 em dois" selected={asiMode === 'oneOne'} onPress={() => (setAsiMode('oneOne'), setAsiPicks([]))} />
                    </View>
                    <View style={styles.chips}>
                      {ABILITIES.map((a) => (
                        <Chip
                          key={a}
                          label={`${ABILITY_LABEL[a].short} ${derived.scores[a]}`}
                          selected={asiPicks.includes(a)}
                          disabled={derived.scores[a] >= 20}
                          onPress={() => toggleAsi(a)}
                        />
                      ))}
                    </View>
                  </>
                )}
                {choosing && selected.branch && (
                  selected.branch.sub.key === pendingSubclass ? (
                    <Text style={[styles.cardNote, { color: selected.branch.color }]}>✦ Subclasse escolhida</Text>
                  ) : (
                    <Button label={`Escolher ${tr.name(selected.branch.sub)}`} onPress={() => setPendingSubclass(selected.branch!.sub.key)} />
                  )
                )}
              </StarCard>
            )
          }
        />
      </View>

      {celebration && (
        <LevelUpCelebration level={celebration.level} gains={celebration.gains} onClose={() => {
            setCelebration(null);
            holdTheme(false);
          }}
        />
      )}
    </View>
  );
}

/** Painel da estrela tocada: aparece ao lado dela, com a descrição e (subindo de nível) a escolha. */
function StarCard({
  entry,
  unlocked,
  onClose,
  children,
}: {
  entry: TreeEntry;
  unlocked: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { star, branch } = entry;
  return (
    <View style={[styles.card, branch && { borderColor: branch.color }]}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          {branch && <Text style={[styles.cardBranch, { color: branch.color }]}>{subclassLabel(branch.sub).toUpperCase()}</Text>}
          <Text style={styles.cardTitle}>{star.name}</Text>
          <Text style={styles.cardLevel}>
            {star.levels.length > 1 ? `Níveis ${star.levels.join(', ')}` : `Nível ${star.level}`}
            {unlocked ? ' · desbloqueada' : ''}
            {star.original ? ` · ${star.original}` : ''}
          </Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}>
          <MaterialCommunityIcons name="close" size={18} color={SKY.muted} />
        </Pressable>
      </View>
      {children}
      <ScrollView style={styles.cardScroll} nestedScrollEnabled>
        <Text style={styles.cardText}>{plainText(star.desc)}</Text>
      </ScrollView>
    </View>
  );
}

const LABEL_WIDTH = 120;
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

interface Placed {
  star: StarData;
  x: number;
  y: number;
  lit: boolean;
  branch: Branch | null;
}

/**
 * Árvore única: o tronco da classe sobe do nível 1 (embaixo) ao 20 (em cima) e, no nível da subclasse,
 * se abre numa ramificação por subclasse. Escolhida a subclasse, só a ramificação dela fica.
 */
function SkillTree({
  width,
  level,
  trunk,
  branches,
  chosenKey,
  choosing,
  glowing,
  selectedId,
  onSelect,
  levelAction,
  popover,
}: {
  width: number;
  level: number;
  trunk: StarData[];
  branches: Branch[];
  chosenKey: string | null;
  choosing: boolean;
  glowing: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Botões de subir/confirmar nível: ficam numa faixa da árvore entre o nível atual e o próximo. */
  levelAction: ReactNode;
  /** Painel da estrela selecionada, posicionado ao lado dela. */
  popover: ReactNode;
}) {
  // Ramificações só se fecham na subclasse salva; escolhendo na subida, todas continuam à mostra (dá para
  // mudar de ideia até confirmar) e a escolhida brilha.
  const chosen = choosing ? null : (branches.find((b) => b.sub.key === chosenKey) ?? null);
  const visibleBranches = chosen ? [chosen] : branches;

  // Cada nível tem a altura do seu maior grupo de estrelas (no tronco ou numa ramificação), de baixo para cima.
  const countAt = (stars: StarData[], lvl: number) => stars.filter((s) => s.level === lvl).length;
  const levelBase = new Map<number, number>();
  let offset = 0;
  // A faixa dos botões abre espaço próprio logo abaixo do próximo nível (não cobre nenhuma estrela).
  let actionCenter: number | null = null;
  for (let lvl = 1; lvl <= MAX_LEVEL; lvl++) {
    if (levelAction && lvl === level + 1) {
      actionCenter = offset + ACTION_ROW / 2;
      offset += ACTION_ROW;
    }
    levelBase.set(lvl, offset);
    const slots = Math.max(countAt(trunk, lvl), ...visibleBranches.map((b) => countAt(b.stars, lvl)));
    offset += slots ? slots * SLOT + LEVEL_GAP : EMPTY_LEVEL;
  }
  const height = PADDING * 2 + offset;
  const yOf = (lvl: number, slot: number) => height - PADDING - (levelBase.get(lvl) ?? 0) - slot * SLOT;

  // Pulsar do brilho (só anima enquanto há algo brilhando).
  const [pulse, setPulse] = useState(0);
  const animating = glowing.size > 0 || choosing;
  useEffect(() => {
    if (!animating) return;
    let frame = 0;
    const tick = () => {
      setPulse(Date.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [animating]);
  const wave = (phase = 0) => 0.5 + 0.5 * Math.sin(pulse / 380 + phase);

  // Estrelas do mesmo nível: uma em cada espaço, subindo (a bifurcação da subclasse fica por cima).
  const placeColumn = (stars: StarData[], baseX: number, branch: Branch | null, lit: (s: StarData) => boolean): Placed[] => {
    const ordered = [...stars].sort((a, b) => a.level - b.level || Number(a.kind === 'subclass') - Number(b.kind === 'subclass'));
    return ordered.map((star) => {
      const slot = ordered.filter((s) => s.level === star.level).indexOf(star);
      return { star, branch, lit: lit(star), x: baseX + (seeded(star.id, 1) - 0.5) * 12, y: yOf(star.level, slot) };
    });
  };

  // Tronco à esquerda do centro (nomes à esquerda dele); as ramificações à direita.
  const trunkX = branches.length ? width * 0.42 : width * 0.5;
  const trunkPlaced = placeColumn(trunk, trunkX, null, (s) => s.level <= level);
  const fork = trunkPlaced.find((p) => p.star.kind === 'subclass');
  const branchPlaced = visibleBranches.map((b, k) => {
    const n = visibleBranches.length;
    const x = chosen ? width * 0.62 : width * (0.6 + (n === 1 ? 0.15 : (k / (n - 1)) * 0.33));
    return placeColumn(b.stars, x, b, (s) => !!chosen && s.level <= level);
  });
  const everything = [...trunkPlaced, ...branchPlaced.flat()];
  const selected = everything.find((p) => p.star.id === selectedId);

  const backgroundStars = Array.from({ length: 110 }, (_, i) => ({
    x: seeded('tree-bg', i) * width,
    y: seeded('tree-bg', i + 100) * height,
    r: 0.4 + seeded('tree-bg', i + 200) * 1.1,
    o: 0.2 + seeded('tree-bg', i + 300) * 0.7,
  }));
  const palette = NEBULAE[0]!;

  const chain = (placed: Placed[], color: string, key: string, from?: Placed) => {
    const points = from ? [from, ...placed] : placed;
    return points.slice(1).map((p, i) => {
      const prev = points[i]!;
      const lit = prev.lit && p.lit;
      return (
        <Line
          key={`${key}-${i}`}
          x1={prev.x}
          y1={prev.y}
          x2={p.x}
          y2={p.y}
          stroke={lit ? color : SKY.locked}
          strokeOpacity={lit ? 0.85 : 0.35}
          strokeWidth={lit ? 1.6 : 1}
        />
      );
    });
  };

  // Painel ao lado da estrela: abaixo dela na metade de cima da árvore, acima na metade de baixo, mas sem
  // nunca cobrir a faixa dos botões de subir/confirmar (vira para o outro lado ou passa por baixo dela).
  const cardWidth = Math.min(CARD_WIDTH, width - 16);
  const cardPosition = selected && {
    left: Math.max(8, Math.min(width - cardWidth - 8, selected.x - cardWidth / 2)),
    ...cardVertical(selected.y),
  };
  function cardVertical(y: number): { top: number } | { bottom: number } {
    const below = { top: y + 22 };
    const above = { bottom: height - y + 22 };
    if (actionCenter === null) return y < height / 2 ? below : above;
    const rowTop = height - PADDING - actionCenter - ACTION_ROW / 2;
    const rowBottom = rowTop + ACTION_ROW;
    const fitsAbove = y - 22 - CARD_HEIGHT > 0 && (y < rowTop || y - 22 - CARD_HEIGHT > rowBottom);
    const fitsBelow = y + 22 + CARD_HEIGHT < height && (y > rowBottom || y + 22 + CARD_HEIGHT < rowTop);
    if (y < height / 2 ? fitsBelow : !fitsAbove && fitsBelow) return below;
    if (fitsAbove) return above;
    // Sem espaço dos dois lados: abre logo depois da faixa, do lado da estrela.
    return y < rowTop ? { bottom: height - rowTop + 8 } : { top: rowBottom + 8 };
  }

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {palette.map((color, i) => (
            <RadialGradient key={i} id={`tree-neb-${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color} stopOpacity={0.5} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          ))}
          <RadialGradient id="tree-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={SKY.star} stopOpacity={0.95} />
            <Stop offset="0.35" stopColor={SKY.glow} stopOpacity={0.45} />
            <Stop offset="1" stopColor={SKY.glow} stopOpacity={0} />
          </RadialGradient>
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
        {backgroundStars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />
        ))}

        {chain(trunkPlaced, SKY.line, 'trunk')}
        {branchPlaced.map((placed, k) => chain(placed, visibleBranches[k]!.color, `branch-${k}`, fork))}

        {everything.map(({ star, x, y, lit, branch }) => {
          const tint = branch ? branch.color : star.kind === 'asi' ? SKY.asi : star.kind === 'subclass' ? SKY.sub : SKY.star;
          const isSelected = star.id === selectedId;
          const glows = glowing.has(star.id) || (choosing && !!branch && branch.stars[0]?.id === star.id);
          const halo = glows ? 14 + 10 * wave(seeded(star.id, 5) * 6) : 0;
          return [
            glows ? (
              <Circle
                key={`h-${star.id}`}
                cx={x}
                cy={y}
                r={halo}
                fill="none"
                stroke={branch ? branch.color : SKY.glow}
                strokeWidth={1.5}
                strokeOpacity={0.35 + 0.5 * wave()}
              />
            ) : null,
            lit || glows ? (
              <Circle
                key={`g-${star.id}`}
                cx={x}
                cy={y}
                r={isSelected ? 22 : 16}
                fill="url(#tree-glow)"
                opacity={glows && !lit ? 0.4 + 0.5 * wave() : 1}
              />
            ) : null,
            <Circle key={`c-${star.id}`} cx={x} cy={y} r={isSelected ? 5 : lit || glows ? 4 : 3.2} fill={lit || glows ? tint : SKY.locked} />,
            !lit && !glows ? (
              <Circle
                key={`r-${star.id}`}
                cx={x}
                cy={y}
                r={isSelected ? 11 : 7}
                stroke={isSelected ? tint : SKY.locked}
                strokeOpacity={0.6}
                strokeWidth={1}
                fill="none"
              />
            ) : null,
            isSelected ? <Circle key={`s-${star.id}`} cx={x} cy={y} r={11} stroke={tint} strokeWidth={1.2} fill="none" /> : null,
          ];
        })}
      </Svg>

      {/* Nomes: tronco à esquerda das estrelas; a ramificação escolhida à direita. Sem escolha, as
          ramificações ficam só com as estrelas (o nome aparece ao tocar). */}
      {everything.map(({ star, x, y, lit, branch }) => {
        if (branch && !chosen) return null;
        const right = !!branch;
        const glows = glowing.has(star.id);
        const tint = branch ? branch.color : star.kind === 'asi' ? SKY.asi : star.kind === 'subclass' ? SKY.sub : SKY.text;
        return (
          <Text
            key={`l-${star.id}`}
            numberOfLines={2}
            style={[
              styles.starName,
              { pointerEvents: 'none' },
              {
                top: y - 9,
                left: right ? x + 14 : Math.max(4, x - 14 - LABEL_WIDTH),
                width: right ? Math.min(LABEL_WIDTH, width - x - 18) : Math.min(LABEL_WIDTH, x - 18),
                textAlign: right ? 'left' : 'right',
                color: lit || glows ? tint : SKY.locked,
              },
            ]}
          >
            {star.name.toUpperCase()}
          </Text>
        );
      })}
      {everything.map(({ star, x, y, lit, branch }) => (
        <Pressable
          key={`p-${star.id}`}
          onPress={() => onSelect(star.id)}
          accessibilityRole="button"
          accessibilityLabel={`${branch ? `${tr.name(branch.sub)}: ` : ''}${star.name}, nível ${star.level}${lit ? ', desbloqueada' : ''}`}
          style={[styles.hit, { left: x - 22, top: y - 22 }]}
        />
      ))}

      {actionCenter !== null && (
        <View style={[styles.actionRow, { top: height - PADDING - actionCenter - ACTION_ROW / 2, height: ACTION_ROW, pointerEvents: 'box-none' }]}>
          <View style={[styles.frontier, { pointerEvents: 'none' }]} />
          {levelAction}
        </View>
      )}

      {cardPosition && popover ? <View style={[styles.cardAnchor, { width: cardWidth }, cardPosition]}>{popover}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  flex: { flex: 1 },
  sky: { backgroundColor: SKY.bg, borderRadius: radius.lg, overflow: 'hidden', paddingBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  legendary: {
    borderWidth: 1,
    borderColor: 'rgba(255,230,176,0.5)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  legendaryText: { color: SKY.text, fontFamily: fonts.display, fontSize: 12, letterSpacing: 2 },
  subclassName: { color: SKY.sub, fontFamily: fonts.displayMedium, fontSize: 12, letterSpacing: 1.5, textAlign: 'center', marginTop: spacing.xs },
  hint: { color: SKY.muted, fontSize: 13, textAlign: 'center', fontStyle: 'italic', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  starName: {
    position: 'absolute',
    width: LABEL_WIDTH,
    fontFamily: fonts.displayMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    ...textGlow('#000', 4),
  },
  hit: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
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
  action: { alignItems: 'center', gap: 6 },
  actionButtons: { flexDirection: 'row', gap: spacing.sm },
  actionGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,230,176,0.6)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: SKY.bg,
  },
  actionGhostText: { color: SKY.star, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  actionSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(154,160,190,0.5)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: SKY.bg,
  },
  actionSecondaryText: { color: SKY.muted, fontSize: 13, fontWeight: '700' },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: SKY.star,
  },
  actionPrimaryText: { color: SKY.bg, fontSize: 13, fontWeight: '800' },
  actionHint: {
    color: SKY.star,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    maxWidth: 320,
    paddingHorizontal: spacing.md,
    backgroundColor: SKY.bg,
  },
  card: {
    borderWidth: 1,
    borderColor: 'rgba(255,230,176,0.55)',
    borderRadius: radius.md,
    backgroundColor: 'rgba(10,12,26,0.96)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  cardBranch: { fontFamily: fonts.displayMedium, fontSize: 10, letterSpacing: 1.5 },
  cardTitle: { color: SKY.star, fontFamily: fonts.display, fontSize: 17 },
  cardLevel: { color: SKY.muted, fontSize: 12 },
  cardNote: { fontSize: 13, fontWeight: '700' },
  cardScroll: { maxHeight: 170 },
  cardText: { color: SKY.text, fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
