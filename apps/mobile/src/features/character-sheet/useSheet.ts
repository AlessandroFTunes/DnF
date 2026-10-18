import { useCallback, useEffect, useMemo, useState } from 'react';
import { abilityModifier, Character, proficiencyBonus, type Ability } from '@dnf/core/character';
import {
  abilityFromName,
  applyFeatureIncreases,
  armorClass,
  asiLevels,
  backgroundRules,
  characterSpellSlots,
  classFeaturesUpTo,
  classRules,
  hitDicePools,
  isBodyArmor,
  isShield,
  isWeaponProficient,
  multiclassProficiencies,
  skillBonus,
  SKILLS,
  speciesRules,
  spellcastingAbility,
  spellSlots,
  spellStats,
  subclassLevel,
  toolName,
  weaponAttack,
  type SrdClassDetail,
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
  const classKeys = character?.classes.map((c) => c.classKey) ?? [];
  const classesID = classKeys.join(',');
  const level = character?.level ?? 1;

  // Multiclasse: uma consulta para todas as classes do personagem (na ordem de `character.classes`).
  const classQ = useSrd(classesID ? `classDetails:${classesID}` : null, () => Promise.all(classKeys.map((k) => srd.classDetail(k))));
  const subclassesQ = useSrd(classesID ? `subclassesOf:${classesID}` : null, () => Promise.all(classKeys.map((k) => srd.subclasses(k))));
  // Ao entrar numa classe nova, a consulta muda de chave e volta a carregar: até chegar, a ficha segue com as
  // classes já carregadas (a árvore não desmonta no meio da comemoração do nível).
  const [loadedClasses, setLoadedClasses] = useState<{ id: string; data: SrdClassDetail[] } | null>(null);
  if (classQ.status === 'ready' && loadedClasses?.id !== classesID) setLoadedClasses({ id: classesID, data: classQ.data });
  const classDetails = classQ.status === 'ready' ? classQ.data : (loadedClasses?.data ?? null);
  const multiclassQ = useSrd(edition && classKeys.length > 1 ? `multiclassSlots:${edition}` : null, () => srd.multiclassSlots(edition!));
  const speciesQ = useSrd(edition && `species:${edition}`, () => srd.species(edition!));
  const backgroundsQ = useSrd(edition && `backgrounds:${edition}`, () => srd.backgrounds(edition!));
  const languagesQ = useSrd('languages', () => srd.languages());
  const featsQ = useSrd(edition && `feats:${edition}`, () => srd.feats(edition!));
  const itemKeys = character?.equipment.items.map((i) => i.key) ?? [];
  const itemsQ = useSrd(itemKeys.length ? `itemsByKey:${[...itemKeys].sort().join(',')}` : null, () =>
    srd.itemsByKey(itemKeys),
  );
  // Nomes das ferramentas guardadas (ex.: as da multiclasse) vêm da lista da edição.
  const toolsQ = useSrd(edition && character?.proficiencies.tools.length ? `items:${edition}` : null, () => srd.items(edition!));
  const spellKeys = character?.spellcasting.spells.map((s) => s.key) ?? [];
  const spellsQ = useSrd(spellKeys.length ? `spellsByKey:${[...spellKeys].sort().join(',')}` : null, () =>
    srd.spellsByKey(spellKeys),
  );

  const derived = useMemo(() => {
    if (!character || !classDetails) return null;
    const pb = proficiencyBonus(level);
    const skills = SKILLS;
    const subclassLists = subclassesQ.status === 'ready' ? subclassesQ.data : [];
    // Cada classe no nível que o personagem tem nela; a primeira é a classe inicial.
    const classes = character.classes.flatMap((entry, i) => {
      const cls = classDetails.find((c) => c.key === entry.classKey);
      if (!cls) return [];
      const klass = classRules(cls, skills);
      // A lista só vale se for desta mesma combinação de classes (pode estar recarregando).
      const subclasses = subclassLists.length === character.classes.length ? (subclassLists[i] ?? []) : [];
      const subclass = subclasses.find((s) => s.key === entry.subclassKey) ?? null;
      return [{
        entry,
        level: entry.level,
        cls,
        klass,
        subclasses,
        subclass,
        subclassLevel: subclassLevel(subclasses, cls),
        asiLevels: asiLevels(cls),
        features: classFeaturesUpTo(cls, entry.level),
        subclassFeatures: subclass ? classFeaturesUpTo(subclass, entry.level) : [],
        hitDie: klass.hitDie,
      }];
    });
    const primary = classes[0];
    if (!primary) return null;
    const { cls, klass, subclasses, subclass } = primary;
    const features = classes.flatMap((c) => c.features);
    const subclassFeatures = classes.flatMap((c) => c.subclassFeatures);
    // A ficha guarda os valores base + escolhas; aumentos de características (Campeão Primitivo…) vêm da API.
    const scores = applyFeatureIncreases(character.abilities, [...features, ...subclassFeatures]);
    // Multiclasse: as classes seguintes dão só parte das proficiências (armas, armaduras).
    const multiclass = classes.slice(1).map((c) => multiclassProficiencies(c.cls, skills));
    const weaponTrainings = [klass.weaponTraining, ...multiclass.map((p) => p.weapons.join(', '))].filter(Boolean);

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
      unarmoredDefense: classes.map((c) => c.klass.unarmoredDefense).find((a) => a !== null) ?? null,
    });

    const attacks = inventory
      .filter((i) => i.item?.weapon && i.equipped)
      .map((i) => ({
        key: i.key,
        name: i.item!.name,
        ...weaponAttack(i.item!.weapon, scores, pb, weaponTrainings.some((t) => isWeaponProficient(i.item!.weapon!, t)))!,
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
    // Espaços de magia de todas as classes (tabela de multiclasse se mais de uma conjura); Pacto à parte.
    const { slots, pact } = characterSpellSlots(
      classes.map((c) => ({ cls: c.cls, subclass: c.subclass, level: c.level })),
      multiclassQ.status === 'ready' ? multiclassQ.data : [],
    );
    // Cada classe conjura com o próprio atributo e escolhe magias da própria lista, até o círculo do nível dela.
    const casters = classes.flatMap((c) => {
      const own = spellSlots(c.cls, c.level);
      const fromSubclass = c.subclass?.casting && c.level >= c.subclassLevel ? (abilityFromName(c.subclass.casting.atributo) ?? null) : null;
      // Paladino/patrulheiro de 2014 só conjuram do 2º nível em diante: o atributo vem da feature.
      const ability = c.klass.spellcasting?.ability ?? (Object.keys(own).length ? spellcastingAbility(c.cls) : null) ?? fromSubclass;
      if (!ability) return [];
      return [{ cls: c.cls, ability, magic: spellStats(ability, scores, pb), maxCircle: Math.max(0, ...Object.keys(own).map(Number)) }];
    });
    const castAbility = casters[0]?.ability ?? null;
    const magic = casters[0]?.magic ?? null;
    const knownLanguages = [
      ...(edition === '2024' ? languages.filter((l) => l.key === 'common') : languages.filter((l) => species?.languages.includes(l.name))),
      ...languages.filter((l) => character.proficiencies.languages.includes(l.key)),
    ];

    return {
      scores,
      pb,
      classes,
      subclasses,
      subclass,
      subclassLevel: primary.subclassLevel,
      asiLevels: primary.asiLevels,
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
      pact,
      casters,
      magic,
      knownLanguages,
      features,
      subclassFeatures,
      spells: spellsQ.status === 'ready' ? spellsQ.data : [],
      /** Magias/subclasses ainda chegando. */
      spellsLoading: character.spellcasting.spells.length > 0 && spellsQ.status === 'loading',
      subclassesLoading: subclassesQ.status === 'loading',
      hitDie: klass.hitDie,
      /** Dados de vida por tipo (multiclasse), do maior para o menor, com os gastos. */
      hitDice: hitDicePools(classes, character.combat.hitDiceSpent),
      /** Ferramentas escolhidas pelo jogador (multiclasse), pelo nome. */
      tools:
        toolsQ.status === 'ready'
          ? character.proficiencies.tools.map((k) => toolName(k, toolsQ.data)).filter((n): n is string => !!n)
          : [],
    };
  }, [character, level, edition, classDetails, subclassesQ, multiclassQ, toolsQ, speciesQ, backgroundsQ, languagesQ, featsQ, itemsQ, spellsQ]);

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
    retrySrd: () => [classQ, subclassesQ, multiclassQ, speciesQ, backgroundsQ, itemsQ, spellsQ].forEach((q) => q.retry()),
  };
}

export type Sheet = ReturnType<typeof useSheet>;
export type SheetData = NonNullable<Sheet['derived']>;
