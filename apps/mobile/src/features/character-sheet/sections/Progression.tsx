import { useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Defs, Ellipse, Line, Path, RadialGradient, Stop } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ABILITIES, abilityModifier, type Ability } from '@dnf/core/character';
import {
  abilityIncreaseOf,
  asiLevels,
  classRules,
  featHitPointsPerLevel,
  featuresByLevel,
  findItem,
  meetsMulticlassRequirements,
  multiclassProficiencies,
  multiclassRequirements,
  plainText,
  subclassLevel,
  toolKey,
  type SrdClassDetail,
  type SrdClassFeature,
} from '@dnf/sdk/srd';
import { Button, Chip, fonts, formatBonus, radius, spacing } from '@dnf/ui-react-native';
import { ABILITY_LABEL, subclassOrigin } from '../../character-create/labels';
import { LevelUpCelebration, type LevelUpGain } from '../LevelUpCelebration';
import { ThemeHold } from '../themeBlend';
import type { Sheet, SheetData } from '../useSheet';
import { srd, tr, useSrd } from '../../../lib/srd';

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
  multi: '#8CE0B4',
  danger: '#FF8A7A',
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
  /** `hp`: estrela dos PV do próximo nível (só aparece subindo de nível); `multiclass`: o que a classe nova dá. */
  kind: 'feature' | 'asi' | 'subclass' | 'hp' | 'multiclass';
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

/** Classe mostrada na árvore: uma das do personagem (`index`) ou a da multiclasse que vai entrar (`index: null`, nível 0). */
interface ClassView {
  index: number | null;
  cls: SrdClassDetail;
  level: number;
  subclasses: SrdClassDetail[];
  subclass: SrdClassDetail | null;
  subclassLevel: number;
  asiLevels: number[];
  hitDie: number;
}

/** "Força 13 ou Destreza 13" / "Destreza 13 e Sabedoria 13"; null sem requisitos cadastrados. */
function requirementText(cls: SrdClassDetail): string | null {
  const rules = multiclassRequirements(cls);
  if (!rules) return null;
  return rules.requisitos.map((all) => all.map((a) => `${a} ${rules.minimo}`).join(' e ')).join(' ou ');
}

/**
 * Árvore de evolução. Subir de nível acontece nela mesma: as estrelas do próximo nível brilham e as escolhas
 * (PV, atributo, subclasse) são feitas tocando nelas. Com multiclasse, cada classe tem a sua árvore, lado a lado
 * (cada classe nova é construída à esquerda), e o nível sobe na árvore ativa; o botão flutuante de multiclasse
 * abre uma classe nova, se os atributos deixarem.
 */
function ProgressionView({ sheet, derived }: { sheet: Sheet; derived: SheetData }) {
  const character = sheet.character!;
  const { isOwner } = sheet;
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(Math.min(windowWidth - 32, 820));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const holdTheme = useContext(ThemeHold);
  const [celebration, setCelebration] = useState<{ level: number; gains: LevelUpGain[]; multiclass: boolean } | null>(null);
  // Depois de subir: as habilidades do nível novo brilham até o jogador tocar nelas.
  const [fresh, setFresh] = useState<{ classKey: string; level: number; seen: string[] } | null>(null);

  // Classe aberta na árvore e a classe nova da multiclasse (só existe até confirmar o nível).
  const [viewKey, setViewKey] = useState<string | null>(null);
  const [newClassKey, setNewClassKey] = useState<string | null>(null);
  const [multiclassOpen, setMulticlassOpen] = useState(false);
  const [multiclassSkills, setMulticlassSkills] = useState<string[]>([]);
  /** Variante escolhida de cada ferramenta da multiclasse que tem variantes (chave do item → "Alaúde"). */
  const [toolPicks, setToolPicks] = useState<Record<string, string>>({});

  // Subida de nível (escolhas feitas nas estrelas; só vale ao confirmar).
  const [levelingUp, setLevelingUp] = useState(false);
  const [pendingSubclass, setPendingSubclass] = useState<string | null>(null);
  const [hpMode, setHpMode] = useState<'average' | 'roll'>('average');
  const [rolled, setRolled] = useState<number | null>(null);
  const [asiMode, setAsiMode] = useState<'two' | 'oneOne'>('two');
  const [asiPicks, setAsiPicks] = useState<Ability[]>([]);
  const [saving, setSaving] = useState(false);

  const canLevel = isOwner && character.level < MAX_LEVEL;
  const allClassesQ = useSrd(canLevel ? `classes:${character.edition}` : null, () => srd.classes(character.edition));
  const allClasses = allClassesQ.status === 'ready' ? allClassesQ.data : [];
  const newSubclassesQ = useSrd(newClassKey && `subclasses:${newClassKey}`, () => srd.subclasses(newClassKey!));
  const newClass = (newClassKey && allClasses.find((c) => c.key === newClassKey)) || null;
  const itemsQ = useSrd(newClass ? `items:${character.edition}` : null, () => srd.items(character.edition));

  const owned: ClassView[] = derived.classes.map((c, index) => ({ index, ...c }));
  const newView: ClassView | null = (() => {
    if (!newClass) return null;
    const subclasses = newSubclassesQ.status === 'ready' ? newSubclassesQ.data : [];
    return {
      index: null,
      cls: newClass,
      level: 0,
      subclasses,
      subclass: null,
      subclassLevel: subclassLevel(subclasses, newClass),
      asiLevels: asiLevels(newClass),
      hitDie: classRules(newClass).hitDie,
    };
  })();
  // Árvore ativa: a que recebe o próximo nível e mostra as escolhas.
  const view: ClassView =
    newView && viewKey === newView.cls.key ? newView : (owned.find((c) => c.cls.key === viewKey) ?? owned[0]!);
  // Da esquerda para a direita: a classe nova (se houver), depois as classes da mais recente para a inicial.
  const ordered = [...(newView ? [newView] : []), ...[...owned].reverse()];
  const isNew = view.index === null;
  const subclassesLoading = isNew ? newSubclassesQ.status === 'loading' : derived.subclassesLoading;

  // Nível na classe aberta (a árvore) e nível do personagem (a soma).
  const level = view.level;
  const next = level + 1;
  const total = character.level;
  const hasSubclasses = view.subclasses.length > 0;

  // Multiclasse: atributo mínimo da classe nova e de todas as que o personagem já tem.
  const ownedFailing = owned.filter((c) => !meetsMulticlassRequirements(c.cls, derived.scores));
  const candidates = allClasses
    .filter((c) => !owned.some((o) => o.cls.key === c.key))
    .map((cls) => ({ cls, requirement: requirementText(cls), ok: ownedFailing.length === 0 && meetsMulticlassRequirements(cls, derived.scores) }));
  const multiclassGains = newClass ? multiclassProficiencies(newClass, derived.skills) : null;
  const skillChoice = isNew ? multiclassGains?.skillChoice ?? null : null;
  const skillOptions = skillChoice
    ? derived.skills.filter((s) => (skillChoice.options ?? derived.skills.map((x) => x.key)).includes(s.key) && !derived.skillLevels[s.key])
    : [];
  const skillsNeeded = Math.min(skillChoice?.count ?? 0, skillOptions.length);
  // Ferramentas da multiclasse, ligadas ao item da API pelo nome; sem item, ficam guardadas pelo nome.
  const items = itemsQ.status === 'ready' ? itemsQ.data : [];
  const multiclassTools = isNew
    ? (multiclassGains?.tools ?? []).map((name) => ({ name, item: findItem(name, items, 'ferramenta') ?? null }))
    : [];
  const toolsToPick = multiclassTools.filter((t) => t.item?.variants?.length);
  const newToolKeys = multiclassTools.map((t) =>
    t.item ? (t.item.variants?.length ? (toolPicks[t.item.key] ? toolKey(t.item, toolPicks[t.item.key]) : null) : toolKey(t.item)) : t.name,
  );

  const conMod = abilityModifier(derived.scores.con);
  const extraHp = (derived.species?.hpPerLevel ?? 0) + featHitPointsPerLevel(derived.feats);
  const average = Math.floor(view.hitDie / 2) + 1;
  const die = hpMode === 'average' ? average : rolled;
  const gain = die === null ? null : Math.max(1, die + conMod + extraHp);

  const choosing = levelingUp && !view.subclass && next >= view.subclassLevel && hasSubclasses;
  const isAsi = levelingUp && view.asiLevels.includes(next);
  const asiDone = !isAsi || asiPicks.length === (asiMode === 'two' ? 1 : 2);
  const missing = [
    ...(choosing && !pendingSubclass ? ['a subclasse'] : []),
    ...(isAsi && !asiDone ? ['o aumento de atributo'] : []),
    ...(levelingUp && multiclassSkills.length < skillsNeeded ? ['as perícias da multiclasse'] : []),
    ...(levelingUp && toolsToPick.some((t) => !toolPicks[t.item!.key]) ? ['a ferramenta da multiclasse'] : []),
    ...(levelingUp && isNew && multiclassTools.length > 0 && itemsQ.status === 'loading' ? ['(carregando as ferramentas)'] : []),
    ...(gain === null ? ['os pontos de vida'] : []),
  ];
  const ready = levelingUp && missing.length === 0;

  const hpStar: StarData = {
    id: 'hp-next',
    name: gain === null ? 'Pontos de vida' : `+${gain} PV`,
    original: null,
    level: next,
    levels: [next],
    desc: `Seus PV máximos aumentam: a média do d${view.hitDie} (${average}) ou uma rolagem, ${formatBonus(conMod)} de Constituição${extraHp ? ` e +${extraHp} de traços/talentos` : ''}.`,
    kind: 'hp',
  };
  const multiclassStar: StarData | null =
    isNew && multiclassGains
      ? {
          id: 'multiclass',
          name: 'Multiclasse',
          original: null,
          level: 1,
          levels: [1],
          desc: [
            view.cls.api?.multiclasse || 'Ao entrar nesta classe como multiclasse, você ganha só parte das proficiências iniciais dela.',
            requirementText(view.cls) ? `Requisito: ${requirementText(view.cls)}.` : '',
          ]
            .filter(Boolean)
            .join('\n\n'),
          kind: 'multiclass',
        }
      : null;
  const trunk = [
    ...starsOf(view.cls, view.asiLevels, hasSubclasses ? view.subclassLevel : null),
    ...(multiclassStar ? [multiclassStar] : []),
    ...(levelingUp ? [hpStar] : []),
  ];
  const branchesOf = (v: ClassView): Branch[] =>
    v.subclasses.map((sub, i) => ({ sub, color: NEBULAE[1 + (i % (NEBULAE.length - 1))]![1]!, stars: starsOf(sub, [], null) }));
  const branches = branchesOf(view);
  const chosenKey = view.subclass?.key ?? (levelingUp ? pendingSubclass : null);
  const inPath = (branch: Branch | null) => !branch || branch.sub.key === chosenKey;

  const entries: TreeEntry[] = [
    ...trunk.map((star) => ({ star, branch: null })),
    ...branches.flatMap((branch) => branch.stars.map((star) => ({ star, branch }))),
  ];
  const selected = entries.find((e) => e.star.id === selectedId) ?? null;

  // O que brilha: subindo, o que o próximo nível dá; depois de subir, o que acabou de ganhar.
  const freshHere = fresh && fresh.classKey === view.cls.key ? fresh : null;
  const glowing = new Set(
    entries
      .filter(({ branch }) => inPath(branch))
      .filter(({ star }) =>
        levelingUp ? star.level === next : freshHere ? star.level === freshHere.level && !freshHere.seen.includes(star.id) : false,
      )
      .map(({ star }) => star.id),
  );

  const markSeen = (classKey: string, id: string) =>
    setFresh((f) => (f && f.classKey === classKey && !f.seen.includes(id) ? { ...f, seen: [...f.seen, id] } : f));
  const select = (id: string) => {
    setSelectedId((current) => (current === id ? null : id));
    markSeen(view.cls.key, id);
  };

  /** Desfaz as escolhas do nível (cada classe tem as suas). */
  const resetChoices = () => {
    setPendingSubclass(null);
    setHpMode('average');
    setRolled(null);
    setAsiMode('two');
    setAsiPicks([]);
    setMulticlassSkills([]);
    setToolPicks({});
    setSelectedId(null);
  };
  const resetLevelUp = () => {
    resetChoices();
    setLevelingUp(false);
    if (isNew) setViewKey(null);
    setNewClassKey(null);
    setMulticlassOpen(false);
  };

  function startMulticlass(key: string) {
    resetChoices();
    setNewClassKey(key);
    setViewKey(key);
    setLevelingUp(true);
    setMulticlassOpen(false);
  }

  function discardMulticlass() {
    resetChoices();
    setNewClassKey(null);
    setViewKey(null);
  }

  function toggleAsi(a: Ability) {
    const max = asiMode === 'two' ? 1 : 2;
    setAsiPicks((p) => (p.includes(a) ? p.filter((x) => x !== a) : p.length < max ? [...p, a] : p));
  }

  function toggleSkill(key: string) {
    setMulticlassSkills((p) => (p.includes(key) ? p.filter((x) => x !== key) : p.length < skillsNeeded ? [...p, key] : p));
  }

  async function confirm() {
    if (!ready || gain === null) return;
    setSaving(true);
    // A cor da ficha (se virar lendário) só muda depois que a animação do d20 fechar.
    holdTheme(true);
    const abilities = { ...character.abilities };
    if (isAsi) for (const a of asiPicks) abilities[a] = Math.min(20, abilities[a] + (asiMode === 'two' ? 2 : 1));
    const chosenSub = view.subclasses.find((s) => s.key === pendingSubclass);
    const classes =
      view.index === null
        ? [...character.classes, { classKey: view.cls.key, subclassKey: pendingSubclass, level: 1 }]
        : character.classes.map((c, i) =>
            i === view.index ? { ...c, level: next, subclassKey: pendingSubclass ?? c.subclassKey } : c,
          );
    const skills = multiclassSkills.length
      ? { ...character.proficiencies.skills, ...Object.fromEntries(multiclassSkills.map((k) => [k, 'proficient' as const])) }
      : undefined;
    const addedTools = newToolKeys.filter((k): k is string => !!k);
    const tools = addedTools.length ? [...new Set([...character.proficiencies.tools, ...addedTools])] : undefined;
    const saved = await sheet.save({
      classes,
      abilities,
      combat: { hpMax: character.combat.hpMax + gain, hpCurrent: character.combat.hpCurrent + gain },
      ...(skills || tools ? { proficiencies: { skills, tools } } : {}),
    });
    setSaving(false);
    if (!saved) {
      // A ficha voltou ao nível anterior; as escolhas ficam para tentar de novo.
      holdTheme(false);
      return;
    }

    const subclass = chosenSub ?? view.subclass;
    const newFeatures = [
      ...(featuresByLevel(view.cls).get(next) ?? []),
      ...((subclass ? featuresByLevel(subclass).get(next) : undefined) ?? []),
      // Com a subclasse escolhida agora, ela aparece pelo nome no lugar de "Subclasse de X".
    ].filter((f: SrdClassFeature) => !(chosenSub && /^subclasse/i.test(f.name)));
    const skillName = (key: string) => derived.skills.find((s) => s.key === key)?.name ?? key;
    const gains: LevelUpGain[] = [
      ...(isNew ? [{ label: `Multiclasse: ${tr.name(view.cls)}`, kind: 'subclass' as const }] : []),
      ...(chosenSub ? [{ label: tr.name(chosenSub), kind: 'subclass' as const }] : []),
      ...newFeatures.map((f) => ({ label: tr.name(f), kind: 'feature' as const })),
      ...multiclassSkills.map((k) => ({ label: `Perícia: ${skillName(k)}`, kind: 'feature' as const })),
      ...multiclassTools.map((t) => ({
        label: `Ferramenta: ${(t.item && toolPicks[t.item.key]) || t.item?.name || t.name}`,
        kind: 'feature' as const,
      })),
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
    const classKey = view.cls.key;
    resetLevelUp();
    setViewKey(classKey);
    setCelebration({ level: total + 1, gains, multiclass: isNew });
    setFresh({ classKey, level: next, seen: [] });
  }

  const hint = levelingUp
    ? missing.length
      ? `Nível ${total + 1} (${tr.name(view.cls)} ${next}): toque nas estrelas brilhando para escolher ${missing.join(' e ')}.`
      : `Tudo escolhido. Confirme o nível ${total + 1}.`
    : glowing.size > 0
      ? 'As estrelas brilhando são suas novas habilidades. Toque para ler.'
      : subclassesLoading
        ? 'Carregando as subclasses…'
        : 'Toque numa estrela para ler a habilidade.';

  const multi = ordered.length > 1;
  // Um trecho por classe; se não couberem (celular), a árvore é arrastada de lado e começa no trecho ativo.
  const treeWidth = multi ? Math.max(width / ordered.length, Math.min(width, 360)) : width;
  const row = useRef<ScrollView>(null);
  useMouseDrag(row);

  /** Torna ativa a árvore de outra classe (o próximo nível vai para ela). */
  const activate = (key: string) => {
    resetChoices();
    setViewKey(key);
  };

  /** Trecho de uma classe que não é a ativa: só leitura; tocar numa estrela ou no "subir" do título a ativa. */
  function passiveSection(v: ClassView): TreeSection {
    const vBranches = branchesOf(v);
    const vTrunk = starsOf(v.cls, v.asiLevels, vBranches.length ? v.subclassLevel : null);
    const vFresh = fresh && fresh.classKey === v.cls.key ? fresh : null;
    const vGlowing = new Set(
      vFresh
        ? [...vTrunk, ...vBranches.filter((b) => b.sub.key === v.subclass?.key).flatMap((b) => b.stars)]
            .filter((st) => st.level === vFresh.level && !vFresh.seen.includes(st.id))
            .map((st) => st.id)
        : [],
    );
    return {
      key: v.cls.key,
      level: v.level,
      trunk: vTrunk,
      branches: vBranches,
      chosenKey: v.subclass?.key ?? null,
      choosing: false,
      glowing: vGlowing,
      title: treeTitle(v, false),
    };
  }

  /** Título de cada classe (classe · nível), com a subclasse; a classe nova tem o ✕ para desistir. */
  function treeTitle(v: ClassView, active: boolean) {
    const growing = active && levelingUp;
    return (
      <View style={styles.treeTitle}>
        <View style={styles.titleRow}>
          <View style={[styles.legendary, !active && styles.legendaryIdle, v.index === null && styles.legendaryNew]}>
            <Text style={[styles.legendaryText, !active && { color: SKY.muted }]}>
              {tr.name(v.cls).toUpperCase()} · NÍVEL {growing ? `${v.level} → ${v.level + 1}` : v.level}
            </Text>
          </View>
          {v.index === null && (
            <Pressable onPress={discardMulticlass} accessibilityRole="button" accessibilityLabel="Desistir da multiclasse" hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color={SKY.muted} />
            </Pressable>
          )}
          {!active && canLevel && v.level < MAX_LEVEL && (
            <Pressable
              onPress={() => (activate(v.cls.key), setLevelingUp(true))}
              accessibilityRole="button"
              accessibilityLabel={`Subir ${tr.name(v.cls)} para o nível ${v.level + 1}`}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={20} color={SKY.star} />
            </Pressable>
          )}
        </View>
        {v.subclass && <Text style={styles.subclassName}>{subclassLabel(v.subclass)}</Text>}
      </View>
    );
  }

  const sections: TreeSection[] = ordered.map((v) =>
    v.cls.key === view.cls.key
      ? { key: v.cls.key, level, trunk, branches, chosenKey, choosing, glowing, title: multi ? treeTitle(v, true) : undefined }
      : passiveSection(v),
  );

  // A árvore rola de lado quando não cabe (multiclasse ou muitas subclasses) e começa no tronco da classe ativa.
  const widths = sectionWidths(sections, treeWidth);
  const activeIndex = ordered.findIndex((v) => v.cls.key === view.cls.key);
  const scrollTo = Math.max(0, widths.slice(0, activeIndex).reduce((a, b) => a + b, 0) + widths[activeIndex]! / 2 - width / 2);
  const scrollable = widths.reduce((a, b) => a + b, 0) > width + 1;
  useEffect(() => {
    const t = setTimeout(() => row.current?.scrollTo({ x: scrollTo, animated: true }), 50);
    return () => clearTimeout(t);
  }, [scrollTo]);

  return (
    <View style={styles.column}>
      <View style={styles.sky} onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
        {multi ? (
          <Text style={[styles.totalLevel, { paddingTop: spacing.md }]}>
            PERSONAGEM NÍVEL {levelingUp ? `${total} → ${total + 1}` : total}
            {levelingUp ? ` · o nível vai para ${tr.name(view.cls)}` : ''}
          </Text>
        ) : (
          treeTitle(view, true)
        )}
        {!levelingUp && <Text style={styles.hint}>{multi ? `${hint} Arraste para os lados para ver as outras classes.` : hint}</Text>}

        {/* Uma árvore só: a classe original à direita e cada multiclasse ramificando para a esquerda. */}
        <ScrollView ref={row} horizontal scrollEnabled={scrollable} showsHorizontalScrollIndicator={scrollable}>
        <SkillTree
          sectionWidth={treeWidth}
          sections={sections}
          activeKey={view.cls.key}
          selectedId={selectedId}
          onSelect={(section, id) => {
            setMulticlassOpen(false);
            if (section === view.cls.key) return select(id);
            activate(section);
            setSelectedId(id);
            markSeen(section, id);
          }}
          levelAction={
            canLevel ? (
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
                      accessibilityLabel={`Confirmar nível ${total + 1}`}
                      style={[styles.actionPrimary, { opacity: !ready || saving ? 0.45 : 1 }]}
                    >
                      <MaterialCommunityIcons name="check-bold" size={16} color={SKY.bg} />
                      <Text style={styles.actionPrimaryText}>{saving ? 'Salvando…' : `Confirmar nível ${total + 1}`}</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.actionHint}>{hint}</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => setLevelingUp(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Subir ${tr.name(view.cls)} para o nível ${next}`}
                  style={styles.actionGhost}
                >
                  <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={18} color={SKY.star} />
                  <Text style={styles.actionGhostText}>
                    {multi ? `${tr.name(view.cls)} ${next}` : `Subir para o nível ${next}`}
                  </Text>
                </Pressable>
              )
            ) : null
          }
          floating={
            canLevel ? (
              <Pressable
                onPress={() => (setSelectedId(null), setMulticlassOpen(!multiclassOpen))}
                accessibilityRole="button"
                accessibilityLabel="Multiclasse"
                accessibilityState={{ expanded: multiclassOpen }}
                style={[styles.fab, multiclassOpen && styles.fabOpen]}
              >
                <MaterialCommunityIcons name="call-split" size={20} color={multiclassOpen ? SKY.bg : SKY.multi} />
                <Text style={[styles.fabText, multiclassOpen && { color: SKY.bg }]}>MULTI</Text>
              </Pressable>
            ) : null
          }
          floatingPanel={
            multiclassOpen ? (
              <MulticlassPanel
                nextLevel={total + 1}
                candidates={candidates}
                ownedFailing={ownedFailing.map((c) => ({ name: tr.name(c.cls), requirement: requirementText(c.cls) }))}
                chosenKey={newClassKey}
                loading={allClassesQ.status === 'loading'}
                onChoose={startMulticlass}
                onClose={() => setMulticlassOpen(false)}
              />
            ) : null
          }
          popover={
            selected && (
              <StarCard
                entry={selected}
                unlocked={selected.star.level <= level && (!selected.branch || selected.branch.sub.key === view.subclass?.key)}
                onClose={() => setSelectedId(null)}
              >
                {selected.star.kind === 'hp' && (
                  <View style={styles.chips}>
                    <Chip label={`Média: ${average}`} selected={hpMode === 'average'} onPress={() => setHpMode('average')} />
                    <Chip
                      label={rolled === null ? `Rolar d${view.hitDie}` : `Rolou ${rolled} (de novo)`}
                      selected={hpMode === 'roll'}
                      onPress={() => {
                        setHpMode('roll');
                        setRolled(1 + Math.floor(Math.random() * view.hitDie));
                      }}
                      icon={(c) => <MaterialCommunityIcons name="dice-d20-outline" size={14} color={c} />}
                    />
                  </View>
                )}
                {selected.star.kind === 'multiclass' && multiclassGains && (
                  <>
                    <Text style={styles.cardNote}>
                      {[
                        multiclassGains.armor.size ? `Armaduras: ${(view.cls.api?.multiclasse_regras?.armaduras ?? []).join(', ')}` : '',
                        multiclassGains.weapons.length ? `Armas: ${multiclassGains.weapons.join(', ')}` : '',
                        multiclassGains.tools.length ? `Ferramentas: ${multiclassGains.tools.join(', ')}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                    {toolsToPick.map(({ item }) => (
                      <View key={item!.key} style={styles.chips}>
                        <Text style={styles.cardNote}>{tr.name(item!)}: escolha um</Text>
                        {item!.variants!.map((v) => (
                          <Chip
                            key={v}
                            label={v}
                            selected={toolPicks[item!.key] === v}
                            onPress={() => setToolPicks((p) => ({ ...p, [item!.key]: v }))}
                          />
                        ))}
                      </View>
                    ))}
                    {skillsNeeded > 0 && (
                      <>
                        <Text style={styles.cardNote}>
                          Escolha {skillsNeeded} perícia{skillsNeeded > 1 ? 's' : ''} ({multiclassSkills.length}/{skillsNeeded})
                        </Text>
                        <View style={styles.chips}>
                          {skillOptions.map((s) => (
                            <Chip key={s.key} label={s.name} selected={multiclassSkills.includes(s.key)} onPress={() => toggleSkill(s.key)} />
                          ))}
                        </View>
                      </>
                    )}
                  </>
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
        </ScrollView>
      </View>

      {celebration && (
        <LevelUpCelebration level={celebration.level} gains={celebration.gains} multiclass={celebration.multiclass} onClose={() => {
            setCelebration(null);
            holdTheme(false);
          }}
        />
      )}
    </View>
  );
}

/** Painel flutuante da multiclasse: as classes que podem entrar no próximo nível, com os requisitos de cada uma. */
function MulticlassPanel({
  nextLevel,
  candidates,
  ownedFailing,
  chosenKey,
  loading,
  onChoose,
  onClose,
}: {
  nextLevel: number;
  candidates: { cls: SrdClassDetail; requirement: string | null; ok: boolean }[];
  ownedFailing: { name: string; requirement: string | null }[];
  chosenKey: string | null;
  loading: boolean;
  onChoose: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.flex}>
          <Text style={styles.cardBranch}>MULTICLASSE</Text>
          <Text style={styles.cardTitle}>Nova classe no nível {nextLevel}</Text>
          <Text style={styles.cardLevel}>Precisa do atributo mínimo da classe nova e de cada classe que você já tem.</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={10}>
          <MaterialCommunityIcons name="close" size={18} color={SKY.muted} />
        </Pressable>
      </View>
      {ownedFailing.map((o) => (
        <Text key={o.name} style={[styles.cardNote, { color: SKY.danger }]}>
          Para sair de {o.name} é preciso {o.requirement}.
        </Text>
      ))}
      <ScrollView style={styles.cardScroll} nestedScrollEnabled>
        {loading && <Text style={styles.cardText}>Carregando as classes…</Text>}
        {candidates.map(({ cls, requirement, ok }) => (
          <Pressable
            key={cls.key}
            disabled={!ok}
            onPress={() => onChoose(cls.key)}
            accessibilityRole="button"
            accessibilityState={{ disabled: !ok, selected: cls.key === chosenKey }}
            accessibilityLabel={`${tr.name(cls)}: ${requirement ?? 'sem requisito'}${ok ? '' : ', requisitos não cumpridos'}`}
            style={[styles.candidate, cls.key === chosenKey && { borderColor: SKY.multi }]}
          >
            {/* Sem requisito conhecido (homebrew): pode entrar, mas sem o "ok" verde. */}
            <MaterialCommunityIcons
              name={!ok ? 'lock-outline' : requirement ? 'check-circle-outline' : 'help-circle-outline'}
              size={18}
              color={!ok ? SKY.locked : requirement ? SKY.multi : SKY.muted}
            />
            <View style={styles.flex}>
              <Text style={[styles.candidateName, !ok && { color: SKY.locked }]}>{tr.name(cls)}</Text>
              <Text style={styles.cardLevel}>{requirement ?? 'Sem requisito cadastrado'}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
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

const PADDING = 46;
/** Espaço vertical de cada estrela (o nome não aparece na árvore, só no painel ao tocar). */
const SLOT = 34;
/** Folga entre um nível e o próximo; nível sem nada ocupa só `EMPTY_LEVEL`. */
const LEVEL_GAP = 12;
/** Lado do quadrado de cada habilidade. */
const NODE = 24;
const HALO = NODE + 10;
const HIT = 44;
const PULSE_MS = 1400;
const STAR_ICON: Record<StarData['kind'], ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  feature: 'star-four-points',
  asi: 'arm-flex',
  subclass: 'source-branch',
  hp: 'heart-plus',
  multiclass: 'call-split',
};
const EMPTY_LEVEL = 10;
const CARD_WIDTH = 300;
/** Altura máxima do painel da estrela (a descrição rola dentro dele). */
const CARD_HEIGHT = 300;
/** Altura da faixa dos botões de subir/confirmar nível. */
const ACTION_ROW = 92;
/** Faixa extra, no alto da faixa dos botões, para o botão flutuante da multiclasse. */
const FAB_BAND = 44;

interface Placed {
  star: StarData;
  x: number;
  y: number;
  lit: boolean;
  branch: Branch | null;
}

/** Uma classe na árvore: o tronco dela e as ramificações das subclasses, num trecho próprio do céu. */
interface TreeSection {
  key: string;
  /** Nível do personagem nesta classe. */
  level: number;
  trunk: StarData[];
  branches: Branch[];
  chosenKey: string | null;
  choosing: boolean;
  glowing: Set<string>;
  /** Título no alto do trecho (classe · nível); só com multiclasse. */
  title?: ReactNode;
}

interface PlacedStar extends Placed {
  section: string;
}

/** Espaço no alto de cada trecho para o título da classe (multiclasse). */
const TITLE_SPACE = 64;
/** Distância mínima entre as ramificações das subclasses ainda não escolhidas. */
const BRANCH_GAP = 64;

/** Largura de cada trecho: cresce com as subclasses à mostra, para elas não ficarem grudadas (a árvore rola de lado). */
function sectionWidths(sections: TreeSection[], base: number): number[] {
  return sections.map((sec) => {
    const chosen = !sec.choosing && sec.branches.some((b) => b.sub.key === sec.chosenKey);
    const n = chosen ? 1 : sec.branches.length;
    // Tronco no meio e ramificações alternando dos dois lados dele.
    return n > 1 ? Math.max(base, 2 * Math.ceil(n / 2) * BRANCH_GAP + 80) : base;
  });
}

/**
 * Árvore única. Cada classe é um trecho: o tronco sobe do nível 1 (embaixo) ao 20 (em cima) e, no nível da
 * subclasse, se abre numa ramificação por subclasse (escolhida a subclasse, só a dela fica). Com multiclasse, a
 * classe nova sai da raiz da anterior e cresce à esquerda dela; os níveis ficam na mesma altura em todos os
 * trechos. Os botões de subir de nível e o painel das estrelas ficam no trecho ativo.
 */
function SkillTree({
  sectionWidth,
  sections,
  activeKey,
  selectedId,
  onSelect,
  levelAction,
  floating,
  floatingPanel,
  popover,
}: {
  sectionWidth: number;
  /** Da esquerda para a direita; a classe inicial é a última. */
  sections: TreeSection[];
  activeKey: string;
  /** Estrela selecionada no trecho ativo. */
  selectedId: string | null;
  onSelect: (section: string, id: string) => void;
  /** Botões de subir/confirmar nível: ficam numa faixa do trecho ativo entre o nível atual e o próximo. */
  levelAction: ReactNode;
  /** Botão flutuante na faixa dos botões (multiclasse) e o painel que ele abre. */
  floating?: ReactNode;
  floatingPanel?: ReactNode;
  /** Painel da estrela selecionada, posicionado ao lado dela. */
  popover: ReactNode;
}) {
  const widths = sectionWidths(sections, sectionWidth);
  const starts = widths.map((_, i) => widths.slice(0, i).reduce((a, b) => a + b, 0));
  const width = widths.reduce((a, b) => a + b, 0);
  const active = sections.find((sec) => sec.key === activeKey) ?? sections[sections.length - 1]!;
  const activeX = starts[sections.indexOf(active)]!;
  const activeW = widths[sections.indexOf(active)]!;
  const top = sections.some((sec) => sec.title) ? TITLE_SPACE : 0;

  // Ramificações só se fecham na subclasse salva; escolhendo na subida, todas continuam à mostra (dá para
  // mudar de ideia até confirmar) e a escolhida brilha.
  const shapes = sections.map((sec) => {
    const chosen = sec.choosing ? null : (sec.branches.find((b) => b.sub.key === sec.chosenKey) ?? null);
    // No nível da bifurcação, a ramificação começa na altura da estrela da subclasse (a última do tronco nesse
    // nível) e segue para cima, em vez de começar embaixo dela e voltar.
    const forkLevel = sec.trunk.find((st) => st.kind === 'subclass')?.level;
    return { sec, chosen, visible: chosen ? [chosen] : sec.branches, forkLevel };
  });
  const countAt = (stars: StarData[], lvl: number) => stars.filter((st) => st.level === lvl).length;
  const liftOf = (shape: (typeof shapes)[number], lvl: number) => (lvl === shape.forkLevel ? countAt(shape.sec.trunk, lvl) - 1 : 0);

  // Multiclasse como galho: a classe nova nasce na última evolução da classe à direita dela, então os níveis
  // dela começam na altura seguinte à desse nível (a classe inicial começa embaixo). `baseRow` é esse deslocamento.
  const baseRows = sections.map(() => 0);
  for (let i = sections.length - 2; i >= 0; i--) baseRows[i] = baseRows[i + 1]! + sections[i + 1]!.level;
  const rows = Math.max(...baseRows.map((b) => b + MAX_LEVEL));

  // Cada linha tem a altura do seu maior grupo de estrelas, em qualquer trecho, de baixo para cima.
  const levelBase = new Map<number, number>();
  let offset = 0;
  // A faixa dos botões abre espaço próprio logo abaixo do próximo nível da classe ativa.
  let actionCenter: number | null = null;
  const rowHeight = ACTION_ROW + (floating ? FAB_BAND : 0);
  const activeBase = baseRows[sections.indexOf(active)] ?? 0;
  for (let row = 1; row <= rows; row++) {
    if (levelAction && row === activeBase + active.level + 1) {
      actionCenter = offset + rowHeight / 2;
      offset += rowHeight;
    }
    levelBase.set(row, offset);
    const slots = Math.max(
      ...shapes.map((shape, i) => {
        const lvl = row - baseRows[i]!;
        return Math.max(
          countAt(shape.sec.trunk, lvl),
          ...shape.visible.map((b) => (countAt(b.stars, lvl) ? countAt(b.stars, lvl) + liftOf(shape, lvl) : 0)),
        );
      }),
    );
    offset += slots ? slots * SLOT + LEVEL_GAP : EMPTY_LEVEL;
  }
  const height = top + PADDING * 2 + offset;
  const yOf = (row: number, slot: number) => height - PADDING - (levelBase.get(row) ?? 0) - slot * SLOT;

  // Pulsar do brilho: só a opacidade do contorno, no driver nativo (a árvore não renderiza de novo a cada quadro).
  const [pulse] = useState(() => new Animated.Value(0));
  const animating = sections.some((sec) => sec.glowing.size > 0 || sec.choosing);
  useEffect(() => {
    if (!animating) return;
    const half = { duration: PULSE_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== 'web' };
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, ...half }), Animated.timing(pulse, { toValue: 0, ...half })]));
    loop.start();
    return () => loop.stop();
  }, [animating, pulse]);
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.7] });

  // Estrelas do mesmo nível: uma em cada espaço, subindo (a bifurcação da subclasse fica por cima).
  const placed = shapes.map((shape, i) => {
    const { sec, chosen, visible } = shape;
    const x0 = starts[i]!;
    const w = widths[i]!;
    const placeColumn = (stars: StarData[], baseX: number, branch: Branch | null, lit: (st: StarData) => boolean): PlacedStar[] => {
      const ordered = [...stars].sort((a, b) => a.level - b.level || Number(a.kind === 'subclass') - Number(b.kind === 'subclass'));
      return ordered.map((star) => {
        const slot = ordered.filter((st) => st.level === star.level).indexOf(star) + (branch ? liftOf(shape, star.level) : 0);
        return { star, branch, section: sec.key, lit: lit(star), x: baseX, y: yOf(baseRows[i]! + star.level, slot) };
      });
    };
    // Tronco no meio do trecho; as ramificações alternam à direita e à esquerda dele, cada par mais afastado.
    const center = x0 + w / 2;
    const trunk = placeColumn(sec.trunk, center, null, (st) => st.level <= sec.level);
    const fork = trunk.find((pl) => pl.star.kind === 'subclass');
    const branches = visible.map((b, k) => {
      const n = visible.length;
      const gap = n > 1 ? (w / 2 - 40) / Math.ceil(n / 2) : Math.min(w * 0.25, 2 * BRANCH_GAP);
      const x = center + (k % 2 ? -1 : 1) * (Math.floor(k / 2) + 1) * gap;
      return placeColumn(b.stars, x, b, (st) => !!chosen && st.level <= sec.level);
    });
    return { shape, x0, w, trunk, fork, branches };
  });
  const everything = placed.flatMap((p) => [...p.trunk, ...p.branches.flat()]);
  const selected = everything.find((pl) => pl.section === active.key && pl.star.id === selectedId);
  const uid = (pl: PlacedStar) => `${pl.section}:${pl.star.id}`;

  const backgroundStars = Array.from({ length: 110 * sections.length }, (_, i) => ({
    x: seeded('tree-bg', i) * width,
    y: seeded('tree-bg', i + 100000) * height,
    r: 0.4 + seeded('tree-bg', i + 200000) * 1.1,
    o: 0.2 + seeded('tree-bg', i + 300000) * 0.7,
  }));
  const palette = NEBULAE[0]!;

  const chain = (list: Placed[], color: string, key: string, from?: Placed) => {
    const points = from ? [from, ...list] : list;
    return points.slice(1).map((pl, i) => {
      const prev = points[i]!;
      const lit = prev.lit && pl.lit;
      return (
        <Line
          key={`${key}-${i}`}
          x1={prev.x}
          y1={prev.y}
          x2={pl.x}
          y2={pl.y}
          stroke={lit ? color : SKY.locked}
          strokeOpacity={lit ? 0.6 : 0.3}
          strokeWidth={lit ? 1.2 : 1}
        />
      );
    });
  };

  // Multiclasse: o galho sai da última evolução da classe à direita (a estrela mais alta já conquistada no
  // tronco) e sobe em curva até o nível 1 da classe nova, à esquerda.
  const multiclassLinks = placed.slice(0, -1).map((p, i) => {
    const left = p.trunk[0];
    const source = placed[i + 1]!.trunk;
    const right = [...source].reverse().find((pl) => pl.lit) ?? source[0];
    if (!left || !right) return null;
    const lit = left.lit && right.lit;
    // Sai do tronco subindo e se abre para a esquerda, como um galho.
    return (
      <Path
        key={`mc-${left.section}`}
        d={`M ${right.x} ${right.y} C ${right.x - 20} ${right.y - 50}, ${left.x + 60} ${left.y + 30}, ${left.x} ${left.y}`}
        stroke={lit ? SKY.multi : SKY.locked}
        strokeOpacity={lit ? 0.8 : 0.4}
        strokeWidth={lit ? 1.6 : 1}
        strokeDasharray={lit ? undefined : '4 4'}
        fill="none"
      />
    );
  });

  // Painel ao lado da estrela, dentro do trecho dela: abaixo na metade de cima da árvore, acima na metade de
  // baixo, mas sem nunca cobrir a faixa dos botões de subir/confirmar (vira para o outro lado ou passa por baixo).
  const cardWidth = Math.min(CARD_WIDTH, sectionWidth - 16);
  const clampLeft = (x: number) => Math.max(activeX + 8, Math.min(activeX + activeW - cardWidth - 8, x));
  const cardPosition = selected && { left: clampLeft(selected.x - cardWidth / 2), ...cardVertical(selected.y) };
  function cardVertical(y: number): { top: number } | { bottom: number } {
    const below = { top: y + 22 };
    const above = { bottom: height - y + 22 };
    if (actionCenter === null) return y < height / 2 ? below : above;
    const rowTop = height - PADDING - actionCenter - rowHeight / 2;
    const rowBottom = rowTop + rowHeight;
    const fitsAbove = y - 22 - CARD_HEIGHT > 0 && (y < rowTop || y - 22 - CARD_HEIGHT > rowBottom);
    const fitsBelow = y + 22 + CARD_HEIGHT < height && (y > rowBottom || y + 22 + CARD_HEIGHT < rowTop);
    if (y < height / 2 ? fitsBelow : !fitsAbove && fitsBelow) return below;
    if (fitsAbove) return above;
    // Sem espaço dos dois lados: abre logo depois da faixa, do lado da estrela.
    return y < rowTop ? { bottom: height - rowTop + 8 } : { top: rowBottom + 8 };
  }

  const tintOf = (pl: PlacedStar, base: string) =>
    pl.branch
      ? pl.branch.color
      : pl.star.kind === 'asi'
        ? SKY.asi
        : pl.star.kind === 'subclass'
          ? SKY.sub
          : pl.star.kind === 'multiclass'
            ? SKY.multi
            : base;
  const sectionOf = (pl: PlacedStar) => shapes.find((sh) => sh.sec.key === pl.section)!;
  const glowsOf = (pl: PlacedStar) => {
    const { sec } = sectionOf(pl);
    return sec.glowing.has(pl.star.id) || (sec.choosing && !!pl.branch && pl.branch.stars[0]?.id === pl.star.id);
  };

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

        {placed.flatMap(({ shape, x0, w }) =>
          palette.map((_, i) => (
            <Ellipse
              key={`neb-${shape.sec.key}-${i}`}
              cx={x0 + w * (0.25 + seeded(`tree:${shape.sec.key}`, 10 + i) * 0.5)}
              cy={height * (0.15 + i * 0.32)}
              rx={w * (0.4 + seeded(`tree:${shape.sec.key}`, 30 + i) * 0.3)}
              ry={height * 0.18}
              fill={`url(#tree-neb-${i})`}
            />
          )),
        )}
        {backgroundStars.map((st, i) => (
          <Circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#FFFFFF" opacity={st.o} />
        ))}

        {multiclassLinks}
        {placed.map((p) => chain(p.trunk, SKY.line, `trunk-${p.shape.sec.key}`))}
        {placed.flatMap((p) =>
          p.branches.map((list, k) => chain(list, p.shape.visible[k]!.color, `branch-${p.shape.sec.key}-${k}`, p.fork)),
        )}

        {/* Brilho suave atrás das habilidades acesas (os quadrados ficam por cima, fora do Svg). */}
        {everything.map((pl) =>
          pl.lit || glowsOf(pl) ? (
            <Circle key={`g-${uid(pl)}`} cx={pl.x} cy={pl.y} r={pl === selected ? 22 : 17} fill="url(#tree-glow)" opacity={pl.lit ? 0.45 : 0.3} />
          ) : null,
        )}
      </Svg>

      {/* Habilidades: quadrado com ícone, sem nome (o nome e a descrição aparecem no painel ao tocar). */}
      {everything.map((pl) => {
        const { star, x, y, lit, branch } = pl;
        const glows = glowsOf(pl);
        const on = lit || glows;
        const tint = tintOf(pl, SKY.star);
        const isSelected = pl === selected;
        const size = isSelected ? NODE + 4 : NODE;
        return (
          <Pressable
            key={`p-${uid(pl)}`}
            onPress={() => onSelect(pl.section, star.id)}
            accessibilityRole="button"
            accessibilityLabel={`${branch ? `${tr.name(branch.sub)}: ` : ''}${star.name}, nível ${star.level}${lit ? ', desbloqueada' : ''}`}
            style={[styles.hit, { left: x - HIT / 2, top: y - HIT / 2 }]}
          >
            {glows && <Animated.View style={[styles.halo, { borderColor: branch ? branch.color : SKY.glow, opacity: haloOpacity }]} />}
            <View
              style={[
                styles.node,
                {
                  width: size,
                  height: size,
                  borderColor: on ? tint : SKY.locked,
                  borderWidth: isSelected ? 2 : 1,
                  opacity: on ? 1 : 0.55,
                },
              ]}
            >
              <MaterialCommunityIcons name={STAR_ICON[star.kind]} size={13} color={on ? tint : SKY.locked} />
            </View>
          </Pressable>
        );
      })}

      {/* Títulos das classes, no alto de cada trecho. */}
      {placed.map(({ shape, x0, w }) =>
        shape.sec.title ? (
          <View key={`t-${shape.sec.key}`} style={[styles.sectionTitle, { left: x0, width: w, pointerEvents: 'box-none' }]}>
            {shape.sec.title}
          </View>
        ) : null,
      )}

      {actionCenter !== null && (
        <View
          style={[
            styles.actionRow,
            {
              left: activeX,
              width: activeW,
              top: height - PADDING - actionCenter - rowHeight / 2,
              height: rowHeight,
              paddingTop: floating ? FAB_BAND : 0,
              pointerEvents: 'box-none',
            },
          ]}
        >
          <View style={[styles.frontier, { pointerEvents: 'none' }]} />
          {levelAction}
          {floating ? <View style={styles.fabAnchor}>{floating}</View> : null}
        </View>
      )}

      {/* Painel da multiclasse: junto do botão, para o lado com mais espaço. */}
      {floatingPanel && actionCenter !== null ? (
        <View
          style={[
            styles.cardAnchor,
            { width: cardWidth, left: activeX + Math.max(8, activeW - cardWidth - 8) },
            // Faixa na metade de baixo: o painel abre acima dela; senão, logo abaixo do botão.
            height - PADDING - actionCenter > height / 2
              ? { bottom: PADDING + actionCenter + rowHeight / 2 }
              : { top: height - PADDING - actionCenter - rowHeight / 2 + FAB_BAND },
          ]}
        >
          {floatingPanel}
        </View>
      ) : null}

      {cardPosition && popover ? <View style={[styles.cardAnchor, { width: cardWidth }, cardPosition]}>{popover}</View> : null}
    </View>
  );
}

/**
 * Web com mouse: o ScrollView do react-native-web só rola com a roda. Arrastar a árvore rola ela de lado e a
 * página para cima/baixo, como no toque; um arrasto de mais de 5 px não vira clique na estrela.
 */
function useMouseDrag(ref: RefObject<ScrollView | null>) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const el = (ref.current as unknown as { getScrollableNode?: () => HTMLElement } | null)?.getScrollableNode?.();
    if (!el) return;
    let page = el.parentElement;
    while (page && !/(auto|scroll)/.test(getComputedStyle(page).overflowY)) page = page.parentElement;

    let start: { x: number; y: number; left: number; top: number } | null = null;
    let dragged = false;
    el.style.cursor = 'grab';
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      start = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: page?.scrollTop ?? 0 };
      dragged = false;
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!dragged && Math.hypot(dx, dy) < 5) return;
      if (!dragged) {
        dragged = true;
        el.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      el.scrollLeft = start.left - dx;
      if (page) page.scrollTop = start.top - dy;
    };
    const up = () => {
      start = null;
      el.style.cursor = 'grab';
      document.body.style.userSelect = '';
    };
    // Captura: o clique que termina um arrasto não chega na estrela.
    const click = (e: MouseEvent) => {
      if (!dragged) return;
      dragged = false;
      e.stopPropagation();
      e.preventDefault();
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    el.addEventListener('click', click, true);
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      el.removeEventListener('click', click, true);
    };
  }, [ref]);
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
  totalLevel: { color: SKY.muted, fontFamily: fonts.displayMedium, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginTop: spacing.xs },
  treeTitle: { alignItems: 'center', paddingTop: spacing.md, paddingHorizontal: spacing.sm, gap: spacing.xs },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendaryIdle: { borderColor: 'rgba(154,160,190,0.4)' },
  legendaryNew: { borderStyle: 'dashed', borderColor: SKY.multi },
  fabAnchor: { position: 'absolute', top: 4, right: spacing.md },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: SKY.multi,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: SKY.bg,
  },
  fabOpen: { backgroundColor: SKY.multi },
  fabText: { color: SKY.multi, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  candidate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.xs,
  },
  candidateName: { color: SKY.text, fontSize: 14, fontWeight: '700' },
  hint: { color: SKY.muted, fontSize: 13, textAlign: 'center', fontStyle: 'italic', paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  hit: { position: 'absolute', width: HIT, height: HIT, alignItems: 'center', justifyContent: 'center' },
  node: { borderRadius: 4, backgroundColor: '#12142A', alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    left: (HIT - HALO) / 2,
    top: (HIT - HALO) / 2,
    width: HALO,
    height: HALO,
    borderRadius: 6,
    borderWidth: 1.5,
    pointerEvents: 'none',
  },
  cardAnchor: { position: 'absolute' },
  actionRow: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { position: 'absolute', top: 0 },
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
  cardBranch: { color: SKY.multi, fontFamily: fonts.displayMedium, fontSize: 10, letterSpacing: 1.5 },
  cardTitle: { color: SKY.star, fontFamily: fonts.display, fontSize: 17 },
  cardLevel: { color: SKY.muted, fontSize: 12 },
  cardNote: { color: SKY.text, fontSize: 13, fontWeight: '700' },
  cardScroll: { maxHeight: 170 },
  cardText: { color: SKY.text, fontSize: 13, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
