import { useContext, useMemo, useState } from 'react';
import { abilityModifier, type Ability } from '@dnf/core/character';
import { abilityIncreaseOf, featHitPointsPerLevel, featuresByLevel, fightingStyleSlots, type SrdClassFeature } from '@dnf/sdk/srd';
import { formatBonus } from '@dnf/ui-react-native';
import { ABILITY_LABEL } from '../../character-create/labels';
import type { LevelUpGain } from '../LevelUpCelebration';
import { ThemeHold } from '../themeBlend';
import type { Sheet, SheetData } from '../useSheet';
import { tr } from '../../../lib/srd';
import type { StarData } from './nodes';

/** Escolhas da subida de nível (feitas tocando nas estrelas; só valem ao confirmar). */
export function useLevelUp(sheet: Sheet, derived: SheetData) {
  const character = sheet.character!;
  const holdTheme = useContext(ThemeHold);
  const [active, setActive] = useState(false);
  const [pendingSubclass, setPendingSubclass] = useState<string | null>(null);
  const [hpMode, setHpMode] = useState<'average' | 'roll'>('average');
  const [rolled, setRolled] = useState<number | null>(null);
  const [asiMode, setAsiModeState] = useState<'two' | 'oneOne'>('two');
  const [asiPicks, setAsiPicks] = useState<Ability[]>([]);
  const [pendingStyle, setPendingStyle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const next = character.level + 1;
  const conMod = abilityModifier(derived.scores.con);
  const extraHp = (derived.species?.hpPerLevel ?? 0) + featHitPointsPerLevel(derived.feats);
  const average = Math.floor(derived.hitDie / 2) + 1;
  const die = hpMode === 'average' ? average : rolled;
  const gain = die === null ? null : Math.max(1, die + conMod + extraHp);

  const choosing = active && !derived.subclass && next >= derived.subclassLevel && derived.subclasses.length > 0;
  const isAsi = active && derived.asiLevels.includes(next);
  const asiDone = !isAsi || asiPicks.length === (asiMode === 'two' ? 1 : 2);
  // Estilo de Luta novo neste nível (Paladino/Guardião no 2, Campeão no 7): escolhido na estrela dele.
  const subclassAfter = derived.subclass ?? derived.subclasses.find((s) => s.key === pendingSubclass) ?? null;
  const choosingStyle =
    active &&
    derived.fightingStyles.length > 0 &&
    fightingStyleSlots([derived.cls, subclassAfter], next) > fightingStyleSlots([derived.cls, derived.subclass], character.level);
  const missing = [
    ...(choosing && !pendingSubclass ? ['a subclasse'] : []),
    ...(isAsi && !asiDone ? ['o aumento de atributo'] : []),
    ...(choosingStyle && !pendingStyle ? ['o estilo de luta'] : []),
    ...(gain === null ? ['os pontos de vida'] : []),
  ];
  const ready = active && missing.length === 0;

  const hpStar = useMemo<StarData>(
    () => ({
      id: 'hp-next',
      name: gain === null ? 'Pontos de vida' : `+${gain} PV`,
      original: null,
      level: next,
      levels: [next],
      desc: `Seus PV máximos aumentam: a média do d${derived.hitDie} (${average}) ou uma rolagem, ${formatBonus(conMod)} de Constituição${extraHp ? ` e +${extraHp} de traços/talentos` : ''}.`,
      kind: 'hp',
    }),
    [gain, next, average, conMod, extraHp, derived.hitDie],
  );

  const cancel = () => {
    setActive(false);
    setPendingSubclass(null);
    setHpMode('average');
    setRolled(null);
    setAsiModeState('two');
    setAsiPicks([]);
    setPendingStyle(null);
  };

  const setAsiMode = (mode: 'two' | 'oneOne') => {
    setAsiModeState(mode);
    setAsiPicks([]);
  };

  const toggleAsi = (a: Ability) => {
    const max = asiMode === 'two' ? 1 : 2;
    setAsiPicks((p) => (p.includes(a) ? p.filter((x) => x !== a) : p.length < max ? [...p, a] : p));
  };

  const roll = () => {
    setHpMode('roll');
    setRolled(1 + Math.floor(Math.random() * derived.hitDie));
  };

  /** Salva o nível novo e devolve o que o personagem ganhou (`null` se não salvou). */
  async function confirm(): Promise<LevelUpGain[] | null> {
    if (!ready || gain === null) return null;
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
      ...(choosingStyle && pendingStyle ? { featKeys: [...character.featKeys, pendingStyle] } : {}),
      combat: { hpMax: character.combat.hpMax + gain, hpCurrent: character.combat.hpCurrent + gain },
    });
    setSaving(false);
    if (!saved) {
      // A ficha voltou ao nível anterior; as escolhas ficam para tentar de novo.
      holdTheme(false);
      return null;
    }

    const subclass = chosenSub ?? derived.subclass;
    const newFeatures = [
      ...(featuresByLevel(derived.cls).get(next) ?? []),
      ...((subclass ? featuresByLevel(subclass).get(next) : undefined) ?? []),
      // Com a subclasse escolhida agora, ela aparece pelo nome no lugar de "Subclasse de X".
    ].filter((f: SrdClassFeature) => !(chosenSub && /^subclasse/i.test(f.name)));
    const style = choosingStyle ? derived.fightingStyles.find((f) => f.key === pendingStyle) : undefined;
    const gains: LevelUpGain[] = [
      ...(chosenSub ? [{ label: tr.name(chosenSub), kind: 'subclass' as const }] : []),
      ...(style ? [{ label: tr.name(style), kind: 'feature' as const }] : []),
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
    cancel();
    return gains;
  }

  return {
    active,
    start: () => setActive(true),
    cancel,
    confirm,
    next,
    saving,
    ready,
    missing,
    choosing,
    isAsi,
    hpStar,
    average,
    hpMode,
    useAverage: () => setHpMode('average'),
    rolled,
    roll,
    asiMode,
    setAsiMode,
    asiPicks,
    toggleAsi,
    pendingSubclass,
    setPendingSubclass,
    choosingStyle,
    pendingStyle,
    setPendingStyle,
  };
}

export type LevelUp = ReturnType<typeof useLevelUp>;
