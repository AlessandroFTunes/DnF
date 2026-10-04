import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, RadialGradient, Stop } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES, abilityModifier, type Ability } from '@dnf/core/character';
import { featHitPointsPerLevel, featuresByLevel, plainText, type SrdClassDetail, type SrdClassFeature } from '@dnf/sdk/srd';
import { Button, Chip, fonts, formatBonus, radius, spacing, typography } from '@dnf/ui-react-native';
import { ABILITY_LABEL, subclassOrigin } from '../../character-create/labels';
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

/** Nome + origem: livro fora do SRD e/ou subclasse trazida da outra edição ("Chaplain · TOH · regras de 2014"). */
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
  /** Nome em inglês da Open5e, mostrado na descrição quando há tradução. */
  original: string | null;
  level: number;
  levels: number[];
  desc: string;
  kind: 'feature' | 'asi' | 'subclass';
}

interface Constellation {
  key: string;
  title: string;
  /** "Sua subclasse", "Disponível no nível 3"… */
  status: string;
  /** Até que nível as estrelas acendem (0 = constelação ainda bloqueada). */
  litUpTo: number;
  palette: string[];
  stars: StarData[];
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
    // A feature "X Subclass" vira a estrela que liga às constelações das subclasses.
    .filter(({ feature }) => subclassAt === null || !/subclass$/i.test(feature.name))
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
      original: 'Ability Score Improvement',
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
      desc: 'Escolha a especialização da sua classe. Cada subclasse é uma constelação própria: deslize para vê-las.',
      kind: 'subclass',
    });
  }
  return stars.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
}

function constellationsOf(data: SheetData, level: number): Constellation[] {
  const chosen = data.subclass?.key ?? null;
  const classConstellation: Constellation = {
    key: data.cls.key,
    title: tr.name(data.cls),
    status: 'Classe',
    litUpTo: level,
    palette: NEBULAE[0]!,
    stars: starsOf(data.cls, data.asiLevels, data.subclasses.length ? data.subclassLevel : null),
  };
  const subs = [...data.subclasses]
    // A subclasse escolhida vem logo depois da classe.
    .sort((a, b) => Number(b.key === chosen) - Number(a.key === chosen) || a.name.localeCompare(b.name))
    .map((s, i) => ({
      key: s.key,
      title: subclassLabel(s),
      status: s.key === chosen ? 'Sua subclasse' : chosen ? 'Outro caminho' : `Disponível no nível ${data.subclassLevel}`,
      litUpTo: s.key === chosen ? level : 0,
      palette: NEBULAE[1 + (i % (NEBULAE.length - 1))]!,
      stars: starsOf(s, [], null),
    }));
  return [classConstellation, ...subs];
}

export function Progression({ sheet }: { sheet: Sheet }) {
  const { character, derived } = sheet;
  if (!character || !derived) return null;
  return <ProgressionView sheet={sheet} derived={derived} />;
}

function ProgressionView({ sheet, derived }: { sheet: Sheet; derived: SheetData }) {
  const { character, isOwner } = sheet;
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(windowWidth - 32, 820));
  // A constelação aberta é guardada pela chave: escolher uma subclasse muda a ordem da lista.
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [levelingUp, setLevelingUp] = useState(false);
  const pager = useRef<ScrollView>(null);
  const tabs = useRef<ScrollView>(null);
  const level = character!.level;
  const constellations = constellationsOf(derived, level);
  // Todas as páginas têm a mesma altura (a do carrossel); cada constelação se espalha nela.
  const skyHeight = Math.max(380, Math.max(...constellations.map((c) => c.stars.length)) * STAR_SPACING + PADDING * 2);
  const found = constellations.findIndex((c) => c.key === currentKey);
  const page = found >= 0 ? found : 0;
  const current = constellations[page]!;
  const selectedStar = current.stars.find((s) => s.id === selected[current.key]) ?? null;

  // Quando a ordem muda (ex.: acabou de escolher a subclasse) ou a largura muda, o carrossel volta a
  // mostrar a constelação aberta.
  const order = constellations.map((c) => c.key).join('|');
  useEffect(() => {
    pager.current?.scrollTo({ x: page * width, animated: false });
    // Só na troca de ordem/largura; a rolagem do usuário já atualiza `page` pelo onScroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, width]);

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(constellations.length - 1, index));
    setCurrentKey(constellations[next]!.key);
    pager.current?.scrollTo({ x: next * width, animated: true });
    tabs.current?.scrollTo({ x: Math.max(0, next * 120 - width / 2 + 60), animated: true });
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  // Acompanha a rolagem (no web os eventos de fim de rolagem nem sempre chegam).
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    const key = constellations[index]?.key;
    if (key && key !== current.key) setCurrentKey(key);
  };

  return (
    <View style={styles.column}>
      <View style={styles.sky} onLayout={onLayout}>
        <View style={styles.header}>
          <View style={styles.legendary}>
            <Text style={styles.legendaryText}>{current.status.toUpperCase()}</Text>
          </View>
          {isOwner && level < MAX_LEVEL && !levelingUp && (
            <Pressable
              onPress={() => setLevelingUp(true)}
              accessibilityRole="button"
              accessibilityLabel={`Subir para o nível ${level + 1}`}
              style={styles.levelButton}
            >
              <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={18} color={SKY.star} />
              <Text style={styles.levelButtonText}>Nível {level + 1}</Text>
            </Pressable>
          )}
        </View>

        {levelingUp && <LevelUp sheet={sheet} data={derived} onClose={() => setLevelingUp(false)} />}

        <ScrollView
          ref={pager}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
        >
          {constellations.map((c) => (
            <ConstellationView
              key={c.key}
              constellation={c}
              width={width}
              height={skyHeight}
              selectedId={selected[c.key] ?? null}
              onSelect={(id) => setSelected((s) => ({ ...s, [c.key]: s[c.key] === id ? '' : id }))}
            />
          ))}
        </ScrollView>

        {/* Título central como no jogo: NOME + nível */}
        <View style={styles.titleBar}>
          <Pressable onPress={() => goTo(page - 1)} disabled={page === 0} hitSlop={10} accessibilityLabel="Constelação anterior">
            <MaterialCommunityIcons name="chevron-left" size={28} color={page === 0 ? '#333650' : SKY.star} />
          </Pressable>
          <View style={styles.titleCenter}>
            <Text style={styles.constellationName} numberOfLines={1}>
              {current.title.toUpperCase()}
            </Text>
            <Text style={styles.constellationLevel}>{current.litUpTo ? current.litUpTo : '—'}</Text>
          </View>
          <Pressable
            onPress={() => goTo(page + 1)}
            disabled={page === constellations.length - 1}
            hitSlop={10}
            accessibilityLabel="Próxima constelação"
          >
            <MaterialCommunityIcons name="chevron-right" size={28} color={page === constellations.length - 1 ? '#333650' : SKY.star} />
          </Pressable>
        </View>
        <View style={styles.titleRule} />

        {/* Barra com as outras constelações */}
        <ScrollView ref={tabs} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {constellations.map((c, i) => (
            <Pressable key={c.key} onPress={() => goTo(i)} accessibilityRole="tab" accessibilityState={{ selected: i === page }} style={styles.tab}>
              <Text style={[styles.tabText, i === page && styles.tabTextActive]} numberOfLines={1}>
                {c.title.toUpperCase()}
              </Text>
              <Text style={[styles.tabLevel, i === page && styles.tabTextActive]}>{c.litUpTo || '·'}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Descrição da estrela tocada */}
        <View style={styles.description}>
          {selectedStar ? (
            <>
              <Text style={styles.descTitle}>
                {selectedStar.name}
                {selectedStar.original ? <Text style={styles.descOriginal}>{`  (${selectedStar.original})`}</Text> : null}
                <Text style={styles.descLevel}>
                  {'  ·  '}
                  {selectedStar.levels.length > 1 ? `níveis ${selectedStar.levels.join(', ')}` : `nível ${selectedStar.level}`}
                  {selectedStar.level <= current.litUpTo ? ' · desbloqueada' : ''}
                </Text>
              </Text>
              <Text style={styles.descText}>{plainText(selectedStar.desc)}</Text>
            </>
          ) : (
            <Text style={styles.descHint}>
              {derived.subclassesLoading
                ? 'Carregando as constelações das subclasses…'
                : 'Toque numa estrela para ler a habilidade. Deslize para ver as subclasses.'}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

const LABEL_WIDTH = 120;
const STAR_SPACING = 46;
const PADDING = 46;

function ConstellationView({
  constellation,
  width,
  height,
  selectedId,
  onSelect,
}: {
  constellation: Constellation;
  width: number;
  height: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { stars, key, palette, litUpTo } = constellation;
  const cx = width / 2;
  const spread = Math.min(width * 0.3, 190);

  // Caminho em S de baixo (nível 1) para cima, com um pouco de acaso por estrela.
  const points = stars.map((s, i) => {
    const t = stars.length === 1 ? 0.5 : i / (stars.length - 1);
    const wave = Math.sin(t * Math.PI * 2.4 + seeded(key, 0) * 6);
    return {
      star: s,
      x: cx + wave * spread + (seeded(s.id, 1) - 0.5) * 50,
      y: height - PADDING - t * (height - PADDING * 2) + (seeded(s.id, 2) - 0.5) * 14,
      lit: s.level <= litUpTo,
    };
  });

  // Linhas: a corrente principal + alguns atalhos que fecham polígonos (como as constelações do jogo).
  const lines: [number, number][] = points.slice(1).map((_, i) => [i, i + 1]);
  points.forEach((_, i) => {
    if (i >= 3 && seeded(`${key}-${i}`, 3) > 0.62) lines.push([i - 3, i]);
  });

  const backgroundStars = Array.from({ length: 70 }, (_, i) => ({
    x: seeded(`${key}-bg`, i) * width,
    y: seeded(`${key}-bg`, i + 100) * height,
    r: 0.4 + seeded(`${key}-bg`, i + 200) * 1.1,
    o: 0.2 + seeded(`${key}-bg`, i + 300) * 0.7,
  }));

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          {palette.map((color, i) => (
            <RadialGradient key={i} id={`neb-${key}-${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={color} stopOpacity={0.55} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </RadialGradient>
          ))}
          <RadialGradient id={`glow-${key}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={SKY.star} stopOpacity={0.95} />
            <Stop offset="0.35" stopColor={SKY.glow} stopOpacity={0.45} />
            <Stop offset="1" stopColor={SKY.glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {/* nebulosa */}
        {palette.map((_, i) => (
          <Ellipse
            key={i}
            cx={width * (0.25 + seeded(key, 10 + i) * 0.5)}
            cy={height * (0.2 + seeded(key, 20 + i) * 0.6)}
            rx={width * (0.35 + seeded(key, 30 + i) * 0.3)}
            ry={height * (0.22 + seeded(key, 40 + i) * 0.25)}
            fill={`url(#neb-${key}-${i})`}
          />
        ))}
        {backgroundStars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFFFF" opacity={s.o} />
        ))}

        {lines.map(([a, b], i) => {
          const pa = points[a]!;
          const pb = points[b]!;
          const lit = pa.lit && pb.lit;
          return (
            <Line
              key={i}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={lit ? SKY.line : SKY.locked}
              strokeOpacity={lit ? 0.85 : 0.35}
              strokeWidth={lit ? 1.6 : 1}
            />
          );
        })}

        {points.map(({ star, x, y, lit }) => {
          const tint = star.kind === 'asi' ? SKY.asi : star.kind === 'subclass' ? SKY.sub : SKY.star;
          const isSelected = star.id === selectedId;
          return lit
            ? [
                <Circle key={`g-${star.id}`} cx={x} cy={y} r={isSelected ? 22 : 16} fill={`url(#glow-${key})`} />,
                <Circle key={`c-${star.id}`} cx={x} cy={y} r={isSelected ? 5 : 4} fill={tint} />,
                isSelected ? <Circle key={`s-${star.id}`} cx={x} cy={y} r={11} stroke={tint} strokeWidth={1.2} fill="none" /> : null,
              ]
            : [
                <Circle key={`c-${star.id}`} cx={x} cy={y} r={isSelected ? 4.5 : 3.2} fill={SKY.locked} />,
                <Circle
                  key={`r-${star.id}`}
                  cx={x}
                  cy={y}
                  r={isSelected ? 11 : 7}
                  stroke={isSelected ? tint : SKY.locked}
                  strokeOpacity={0.6}
                  strokeWidth={1}
                  fill="none"
                />,
              ];
        })}
      </Svg>

      {/* Nomes e áreas de toque por cima do SVG */}
      {points.map(({ star, x, y, lit }) => {
        const right = x < width / 2;
        const tint = star.kind === 'asi' ? SKY.asi : star.kind === 'subclass' ? SKY.sub : SKY.text;
        return (
          <View key={star.id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Text
              pointerEvents="none"
              numberOfLines={2}
              style={[
                styles.starName,
                {
                  top: y - 9,
                  left: right ? x + 14 : x - 14 - LABEL_WIDTH,
                  textAlign: right ? 'left' : 'right',
                  color: lit ? tint : SKY.locked,
                },
              ]}
            >
              {star.name.toUpperCase()}
            </Text>
            <Pressable
              onPress={() => onSelect(star.id)}
              accessibilityRole="button"
              accessibilityLabel={`${star.name}, nível ${star.level}${lit ? ', desbloqueada' : ''}`}
              style={[styles.hit, { left: x - 22, top: y - 22 }]}
            />
          </View>
        );
      })}
    </View>
  );
}

/** Subir de nível: PV (média ou rolagem), subclasse e aumento de atributo quando o nível pede. */
function LevelUp({ sheet, data, onClose }: { sheet: Sheet; data: SheetData; onClose: () => void }) {
  const character = sheet.character!;
  const next = character.level + 1;
  const conMod = abilityModifier(character.abilities.con);
  const extra = (data.species?.hpPerLevel ?? 0) + featHitPointsPerLevel(data.feats);
  const average = Math.floor(data.hitDie / 2) + 1;

  const [hpMode, setHpMode] = useState<'average' | 'roll'>('average');
  const [rolled, setRolled] = useState<number | null>(null);
  const needsSubclass = !data.subclass && next >= data.subclassLevel && data.subclasses.length > 0;
  const [subclassKey, setSubclassKey] = useState<string | null>(null);
  const isAsi = data.asiLevels.includes(next);
  const [asiMode, setAsiMode] = useState<'two' | 'oneOne'>('two');
  const [asiPicks, setAsiPicks] = useState<Ability[]>([]);
  const [saving, setSaving] = useState(false);

  const die = hpMode === 'average' ? average : rolled;
  const gain = die === null ? null : Math.max(1, die + conMod + extra);
  const newFeatures = featuresByLevel(data.cls).get(next) ?? [];
  const chosenSub: SrdClassDetail | undefined = data.subclasses.find((s) => s.key === subclassKey);
  const subFeatures = (chosenSub ? featuresByLevel(chosenSub) : data.subclass ? featuresByLevel(data.subclass) : new Map()).get(next) ?? [];

  const asiDone = !isAsi || (asiMode === 'two' ? asiPicks.length === 1 : asiPicks.length === 2);
  const ready = gain !== null && (!needsSubclass || !!subclassKey) && asiDone;

  function togglePick(a: Ability) {
    const max = asiMode === 'two' ? 1 : 2;
    setAsiPicks((p) => (p.includes(a) ? p.filter((x) => x !== a) : p.length < max ? [...p, a] : p));
  }

  async function confirm() {
    if (!ready || gain === null) return;
    setSaving(true);
    const abilities = { ...character.abilities };
    if (isAsi) for (const a of asiPicks) abilities[a] = Math.min(20, abilities[a] + (asiMode === 'two' ? 2 : 1));
    const current = character.classes[0]!;
    await sheet.save({
      classes: [{ ...current, level: next, subclassKey: subclassKey ?? current.subclassKey }],
      abilities,
      combat: { hpMax: character.combat.hpMax + gain, hpCurrent: character.combat.hpCurrent + gain },
    });
    setSaving(false);
    onClose();
  }

  return (
    <View style={styles.levelUp}>
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="arrow-up-bold-circle" size={22} color={SKY.star} />
        <Text style={[styles.levelTitle, { color: SKY.star }]}>
          Nível {character.level} → {next}
        </Text>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Cancelar" hitSlop={8}>
          <MaterialCommunityIcons name="close" size={22} color={SKY.muted} />
        </Pressable>
      </View>

      <Text style={[typography.overline, { color: SKY.muted }]}>Pontos de vida</Text>
      <View style={styles.chips}>
        <Chip label={`Média: ${average}`} selected={hpMode === 'average'} onPress={() => setHpMode('average')} />
        <Chip
          label={rolled === null ? `Rolar d${data.hitDie}` : `Rolou ${rolled} (de novo)`}
          selected={hpMode === 'roll'}
          onPress={() => {
            setHpMode('roll');
            setRolled(1 + Math.floor(Math.random() * data.hitDie));
          }}
          icon={(c) => <MaterialCommunityIcons name="dice-d20-outline" size={14} color={c} />}
        />
      </View>
      <Text style={[typography.body, { color: SKY.text }]}>
        {gain === null ? 'Role o dado de vida.' : `+${gain} PV (${die} ${formatBonus(conMod)} CON${extra ? ` +${extra} de traços/talentos` : ''})`}
      </Text>

      {needsSubclass && (
        <>
          <Text style={[typography.overline, { color: SKY.sub }]}>Escolha sua subclasse</Text>
          <View style={styles.chips}>
            {data.subclasses.map((s) => (
              <Chip key={s.key} label={subclassLabel(s)} selected={subclassKey === s.key} onPress={() => setSubclassKey(s.key)} />
            ))}
          </View>
        </>
      )}

      {isAsi && (
        <>
          <Text style={[typography.overline, { color: SKY.asi }]}>Aumento de atributo</Text>
          <View style={styles.chips}>
            <Chip label="+2 em um" selected={asiMode === 'two'} onPress={() => (setAsiMode('two'), setAsiPicks([]))} />
            <Chip label="+1 em dois" selected={asiMode === 'oneOne'} onPress={() => (setAsiMode('oneOne'), setAsiPicks([]))} />
          </View>
          <View style={styles.chips}>
            {ABILITIES.map((a) => (
              <Chip
                key={a}
                label={`${ABILITY_LABEL[a].short} ${character.abilities[a]}`}
                selected={asiPicks.includes(a)}
                disabled={character.abilities[a] >= 20}
                onPress={() => togglePick(a)}
              />
            ))}
          </View>
        </>
      )}

      {(newFeatures.length > 0 || subFeatures.length > 0) && (
        <>
          <Text style={[typography.overline, { color: SKY.muted }]}>Você ganha</Text>
          {[...newFeatures, ...subFeatures].map((f: SrdClassFeature) => (
            <Text key={f.key} style={[typography.caption, { color: SKY.text }]}>
              ✦ {tr.name(f)}
            </Text>
          ))}
        </>
      )}
      {data.casting && (
        <Text style={[typography.caption, { color: SKY.muted }]}>
          Conjuradores: depois de subir, aprenda as novas magias na seção Magias.
        </Text>
      )}

      <Button label={`Confirmar nível ${next}`} onPress={() => void confirm()} disabled={!ready} loading={saving} />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: spacing.lg },
  flex: { flex: 1 },
  sky: { backgroundColor: SKY.bg, borderRadius: radius.lg, overflow: 'hidden', paddingBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: spacing.md, paddingHorizontal: spacing.md },
  legendary: {
    borderWidth: 1,
    borderColor: 'rgba(255,230,176,0.5)',
    paddingHorizontal: spacing.xl,
    paddingVertical: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  legendaryText: { color: SKY.text, fontFamily: fonts.display, fontSize: 12, letterSpacing: 2 },
  levelButton: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,230,176,0.5)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  levelButtonText: { color: SKY.star, fontSize: 12, fontWeight: '800' },
  starName: {
    position: 'absolute',
    width: LABEL_WIDTH,
    fontFamily: fonts.displayMedium,
    fontSize: 10,
    letterSpacing: 0.8,
    textShadowColor: '#000',
    textShadowRadius: 4,
  },
  hit: { position: 'absolute', width: 44, height: 44, borderRadius: 22 },
  titleBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  titleCenter: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexShrink: 1 },
  constellationName: { color: SKY.text, fontFamily: fonts.display, fontSize: 24, letterSpacing: 1.5, flexShrink: 1 },
  constellationLevel: { color: SKY.text, fontFamily: fonts.displayHeavy, fontSize: 26 },
  titleRule: { alignSelf: 'center', width: 140, height: 2, backgroundColor: 'rgba(255,230,176,0.4)', marginTop: 2, marginBottom: spacing.sm },
  tabs: { paddingHorizontal: spacing.md, gap: spacing.xs },
  tab: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,230,176,0.2)',
  },
  tabText: { color: SKY.muted, fontFamily: fonts.displayMedium, fontSize: 11, letterSpacing: 1, maxWidth: 160 },
  tabLevel: { color: SKY.muted, fontFamily: fonts.displayHeavy, fontSize: 12 },
  tabTextActive: { color: SKY.star },
  description: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, minHeight: 64, gap: spacing.xs },
  descTitle: { color: SKY.star, fontFamily: fonts.display, fontSize: 17, textAlign: 'center' },
  descLevel: { color: SKY.muted, fontSize: 12, fontFamily: undefined },
  descOriginal: { color: SKY.muted, fontSize: 12, fontStyle: 'italic', fontFamily: undefined },
  descText: { color: SKY.text, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  descHint: { color: SKY.muted, fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
  levelUp: {
    borderWidth: 1.5,
    borderColor: SKY.star,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    margin: spacing.md,
    backgroundColor: 'rgba(10,13,28,0.92)',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  levelTitle: { fontFamily: fonts.display, fontSize: 18, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
