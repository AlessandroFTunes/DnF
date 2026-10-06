import { useCallback, useEffect, useMemo, useState } from 'react';
import { abilityModifier, Character, proficiencyBonus, type Ability } from '@dnf/core/character';
import {
  applyFeatureIncreases,
  armorClass,
  asiLevels,
  backgroundRules,
  classFeaturesUpTo,
  classRules,
  isBodyArmor,
  isShield,
  isWeaponProficient,
  skillBonus,
  SKILLS,
  speciesRules,
  spellcastingAbility,
  spellSlots,
  spellStats,
  subclassLevel,
  weaponAttack,
  type SrdSpecies,
} from '@dnf/sdk/srd';
import { useSession } from '../../hooks/hook.session';
import { srd, useSrd } from '../../lib/srd';

type Patch = Omit<Parameters<typeof Character.update>[0], 'id'>;

/** Personagem + regras da 5e-FastAPI já aplicadas, e as ações da ficha (PV, espaços, itens…). */
export function useSheet(id: string) {
  const session = useSession();
  const [character, setCharacter] = useState<Character.Info | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'missing' | 'ready'>('loading');
  const [saving, setSaving] = useState(false);

  const [attempt, setAttempt] = useState(0);
  const load = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    Character.fromID(id).then(
      (found) => {
        if (!active) return;
        setCharacter(found);
        setStatus(found ? 'ready' : 'missing');
      },
      () => active && setStatus('error'),
    );
    return () => {
      active = false;
    };
  }, [id, attempt]);

  /** Salva uma mudança; a tela atualiza na hora e volta atrás se o servidor recusar. Diz se salvou. */
  const save = useCallback(
    async (patch: Patch, optimistic?: (c: Character.Info) => Character.Info): Promise<boolean> => {
      if (!character) return false;
      const previous = character;
      if (optimistic) setCharacter(optimistic(character));
      setSaving(true);
      try {
        setCharacter(await Character.update({ id: character.id, ...patch }));
        return true;
      } catch {
        setCharacter(previous);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [character],
  );

  const edition = character?.edition ?? null;
  const classKey = character?.classes[0]?.classKey ?? null;
  const level = character?.level ?? 1;

  const classQ = useSrd(classKey && `class:${classKey}`, () => srd.classDetail(classKey!));
  const subclassesQ = useSrd(classKey && `subclasses:${classKey}`, () => srd.subclasses(classKey!));
  const speciesQ = useSrd(edition && `species:${edition}`, () => srd.species(edition!));
  const backgroundsQ = useSrd(edition && `backgrounds:${edition}`, () => srd.backgrounds(edition!));
  const languagesQ = useSrd('languages', () => srd.languages());
  const featsQ = useSrd(edition && `feats:${edition}`, () => srd.feats(edition!));
  const itemKeys = character?.equipment.items.map((i) => i.key) ?? [];
  const itemsQ = useSrd(itemKeys.length ? `itemsByKey:${[...itemKeys].sort().join(',')}` : null, () =>
    srd.itemsByKey(itemKeys),
  );
  const spellKeys = character?.spellcasting.spells.map((s) => s.key) ?? [];
  const spellsQ = useSrd(spellKeys.length ? `spellsByKey:${[...spellKeys].sort().join(',')}` : null, () =>
    srd.spellsByKey(spellKeys),
  );

  const derived = useMemo(() => {
    if (!character || classQ.status !== 'ready') return null;
    const pb = proficiencyBonus(level);
    const skills = SKILLS;
    const cls = classQ.data;
    const klass = classRules(cls, skills);
    const subclasses = subclassesQ.status === 'ready' ? subclassesQ.data : [];
    const subclassKey = character.classes[0]?.subclassKey ?? null;
    const subclass = subclasses.find((s) => s.key === subclassKey) ?? null;
    const features = classFeaturesUpTo(cls, level);
    const subclassFeatures = subclass ? classFeaturesUpTo(subclass, level) : [];
    // A ficha guarda os valores base + escolhas; aumentos de características (Campeão Primitivo…) vêm da API.
    const scores = applyFeatureIncreases(character.abilities, [...features, ...subclassFeatures]);

    let chain: SrdSpecies[] = [];
    if (speciesQ.status === 'ready') {
      for (const g of speciesQ.data) {
        if (g.key === character.speciesKey) chain = [g];
        const sub = g.subspecies.find((s) => s.key === character.speciesKey);
        if (sub) chain = [g, sub];
      }
    }
    const languages = languagesQ.status === 'ready' ? languagesQ.data : [];
    const species = chain.length ? speciesRules(chain, skills, languages.map((l) => l.name)) : null;
    const background =
      backgroundsQ.status === 'ready' ? (backgroundsQ.data.find((b) => b.key === character.backgroundKey) ?? null) : null;
    const bg = background ? backgroundRules(background, skills) : null;

    // Proficiências: o que a ficha guarda (escolhas) + o que vem da API.
    const skillLevels: Record<string, 'proficient' | 'expertise'> = {};
    for (const key of [...(bg?.skills ?? []), ...(species?.skills ?? [])]) skillLevels[key] = 'proficient';
    for (const [key, level] of Object.entries(character.proficiencies.skills)) {
      if (level === 'none') delete skillLevels[key];
      else skillLevels[key] = level;
    }

    const items = itemsQ.status === 'ready' ? itemsQ.data : [];
    const inventory = character.equipment.items.map((owned) => ({ ...owned, item: items.find((i) => i.key === owned.key) }));
    const armor = inventory.find((i) => i.equipped && i.item && isBodyArmor(i.item));
    const shield = inventory.some((i) => i.equipped && i.item && isShield(i.item));
    const ac = armorClass({
      scores,
      armor: armor?.item?.armor ?? null,
      armorName: armor?.item?.name,
      shield,
      unarmoredDefense: klass.unarmoredDefense,
    });

    const attacks = inventory
      .filter((i) => i.item?.weapon && i.equipped)
      .map((i) => ({
        key: i.key,
        name: i.item!.name,
        ...weaponAttack(i.item!.weapon, scores, pb, isWeaponProficient(i.item!.weapon!, klass.weaponTraining))!,
      }));

    const saves = Object.fromEntries(
      (['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]).map((a) => [
        a,
        abilityModifier(scores[a]) + (klass.savingThrows.includes(a) ? pb : 0),
      ]),
    ) as Record<Ability, number>;

    const perception = skills.find((s) => s.key === 'perception');
    const passivePerception = 10 + (perception ? skillBonus(perception, scores, skillLevels.perception, pb) : 0);

    const feats = featsQ.status === 'ready' ? featsQ.data.filter((f) => character.featKeys.includes(f.key)) : [];
    const casting = klass.spellcasting;
    const slots = spellSlots(cls, level);
    // Paladino/patrulheiro de 2014 só conjuram do 2º nível em diante: o atributo vem da feature.
    const castAbility = casting?.ability ?? (Object.keys(slots).length ? spellcastingAbility(cls) : null);
    const magic = castAbility ? spellStats(castAbility, scores, pb) : null;
    const knownLanguages = [
      ...(edition === '2024' ? languages.filter((l) => l.key === 'common') : languages.filter((l) => species?.languages.includes(l.name))),
      ...languages.filter((l) => character.proficiencies.languages.includes(l.key)),
    ];

    return {
      scores,
      pb,
      subclasses,
      subclass,
      subclassLevel: subclassLevel(subclasses, cls),
      asiLevels: asiLevels(cls),
      skills,
      cls,
      klass,
      chain,
      species,
      background,
      bg,
      skillLevels,
      inventory,
      ac,
      attacks,
      saves,
      passivePerception,
      feats,
      casting,
      castAbility,
      slots,
      magic,
      knownLanguages,
      features,
      subclassFeatures,
      spells: spellsQ.status === 'ready' ? spellsQ.data : [],
      /** Magias/subclasses ainda chegando. */
      spellsLoading: character.spellcasting.spells.length > 0 && spellsQ.status === 'loading',
      subclassesLoading: subclassesQ.status === 'loading',
      hitDie: klass.hitDie,
    };
  }, [character, level, edition, classQ, subclassesQ, speciesQ, backgroundsQ, languagesQ, featsQ, itemsQ, spellsQ]);

  const viewerID = session.status === 'signedIn' ? session.session.userID : null;
  const isOwner = !!character && character.ownerID === viewerID;
  const srdFailed = [classQ].some((q) => q.status === 'error');

  return {
    character,
    status,
    derived,
    isOwner,
    saving,
    save,
    reload: load,
    srdFailed,
    retrySrd: () => [classQ, subclassesQ, speciesQ, backgroundsQ, itemsQ, spellsQ].forEach((q) => q.retry()),
  };
}

export type Sheet = ReturnType<typeof useSheet>;
export type SheetData = NonNullable<Sheet['derived']>;
