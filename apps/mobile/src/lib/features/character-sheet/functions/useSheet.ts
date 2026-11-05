import { useCallback, useMemo, useState } from 'react';
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
  isFightingStyleFeat,
  isShield,
  isWeaponProficient,
  multiclassProficiencies,
  skillBonus,
  SKILLS,
  speciesRules,
  grantedSpellNames,
  spellcastingAbility,
  spellModel,
  subclassSchools,
  spellCountsAt,
  subclassSlots,
  subclassSpellCounts,
  spellSlots,
  spellStats,
  subclassLevel,
  toolName,
  weaponAttack,
  type SrdClassDetail,
  type SrdSpecies,
} from '@dnf/sdk/srd';
import { useSession } from '../../auth/functions/hook.session';
import { useSpellsByNames, useBackgrounds, useClassDetails, useFeats, useItems, useLanguages, useMulticlassSlots, useSpecies, useSpellsByKeys, useSubclassesOf } from '../../srd/functions';
import { useCharacter, useUpdateCharacter, type CharacterPatch } from './queries';

/** Personagem + regras da 5e-FastAPI já aplicadas, e as ações da ficha (PV, espaços, itens…). */
export function useSheet(id: string) {
  const session = useSession();
  // Abre já com o último estado guardado no aparelho (ou o da Home); o do servidor substitui quando chegar.
  const characterQ = useCharacter(id);
  const character = characterQ.status === 'ready' ? characterQ.data : null;
  const status = characterQ.status === 'ready' ? (characterQ.data ? 'ready' : 'missing') : characterQ.status;
  // Salva com atualização otimista; a tela volta atrás se o servidor recusar. `save` diz se salvou.
  const { save: saveCharacter, saving } = useUpdateCharacter(id);
  const save = useCallback(
    async (patch: CharacterPatch, optimistic?: (c: Character.Info) => Character.Info): Promise<boolean> =>
      character ? saveCharacter(patch, optimistic) : false,
    [character, saveCharacter],
  );
  const load = characterQ.retry;

  const edition = character?.edition ?? null;
  const classKeys = character?.classes.map((c) => c.classKey) ?? [];
  const classesID = classKeys.join(',');
  const level = character?.level ?? 1;

  // Multiclasse: uma consulta para todas as classes do personagem (na ordem de `character.classes`).
  const classQ = useClassDetails(classKeys);
  const subclassesQ = useSubclassesOf(classKeys);
  // Ao entrar numa classe nova, a consulta muda de chave e volta a carregar: até chegar, a ficha segue com as
  // classes já carregadas (a árvore não desmonta no meio da comemoração do nível).
  const [loadedClasses, setLoadedClasses] = useState<{ id: string; data: SrdClassDetail[] } | null>(null);
  if (classQ.status === 'ready' && loadedClasses?.id !== classesID) setLoadedClasses({ id: classesID, data: classQ.data });
  const classDetails = classQ.status === 'ready' ? classQ.data : (loadedClasses?.data ?? null);
  const multiclassQ = useMulticlassSlots(edition);
  const speciesQ = useSpecies(edition);
  const backgroundsQ = useBackgrounds(edition);
  const languagesQ = useLanguages();
  const featsQ = useFeats(edition);
  const itemKeys = character?.equipment.items.map((i) => i.key) ?? [];
  // Os itens saem da lista da edição (já baixada ao abrir o app): mudar o inventário não busca nada.
  const itemsQ = useItems(itemKeys.length > 0 && edition);
  // Nomes das ferramentas guardadas (ex.: as da multiclasse) vêm da lista da edição.
  const toolsQ = useItems(!!character?.proficiencies.tools.length && edition);
  const spellKeys = character?.spellcasting.spells.map((s) => s.key) ?? [];
  const spellsQ = useSpellsByKeys(spellKeys);
  // Magias sempre preparadas que a subclasse dá (domínio, patrono, círculo), pelo nome, até o nível na classe.
  const subclassLists = subclassesQ.status === 'ready' ? subclassesQ.data : [];
  const grantedNames = (character?.classes ?? []).flatMap((entry, i) => {
    const sub = subclassLists.length === character!.classes.length ? subclassLists[i]?.find((s) => s.key === entry.subclassKey) : null;
    return grantedSpellNames(sub ?? null, entry.level);
  });
  const grantedQ = useSpellsByNames(grantedNames, edition);

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
    const fightingStyles = featsQ.status === 'ready' ? featsQ.data.filter(isFightingStyleFeat) : [];
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
      // Conjuração da subclasse (Cavaleiro Místico…): espaços pelo nível de conjurador e lista de magias do Mago.
      const viaSubclass = Object.keys(own).length === 0 && !!c.subclass?.casting && c.level >= c.subclassLevel;
      const slotsOf = viaSubclass ? subclassSlots({ cls: c.cls, subclass: c.subclass, level: c.level }, multiclassQ.status === 'ready' ? multiclassQ.data : []) : own;
      const counts = viaSubclass ? subclassSpellCounts(c.subclass!, c.level, edition ?? '2024') : spellCountsAt(c.cls, c.level, scores);
      return [{
        cls: c.cls,
        level: c.level,
        ability,
        magic: spellStats(ability, scores, pb),
        maxCircle: Math.max(0, ...Object.keys(slotsOf).map(Number)),
        viaSubclass,
        counts,
        model: spellModel(c.cls, viaSubclass, counts),
        schools: viaSubclass ? subclassSchools(c.subclass) : [],
      }];
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
      /** Talentos de Estilo de Luta da edição (opções da estrela "Estilo de Luta"). */
      fightingStyles,
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
      /** Magias sempre preparadas que vêm da subclasse, fora dos limites. */
      granted: grantedQ.status === 'ready' ? grantedQ.data : [],
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
  }, [character, level, edition, classDetails, subclassesQ, multiclassQ, toolsQ, speciesQ, backgroundsQ, languagesQ, featsQ, itemsQ, spellsQ, grantedQ]);

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
