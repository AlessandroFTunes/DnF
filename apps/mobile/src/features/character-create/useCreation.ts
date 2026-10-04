import { ABILITIES, type Ability, type AbilityScores } from '@dnf/core/character';
import { DiferenteKey } from '@dnf/core/util';
import {
  applyBonuses,
  subclassLevel,
  backgroundRules,
  classRules,
  skillsFromAbilities,
  speciesRules,
  spellsToChoose,
  type SrdSpecies,
  type SrdSpeciesGroup,
} from '@dnf/sdk/srd';
import { srd, useSrd } from '../../lib/srd';
import { useCharacterDraft, type CharacterDraft } from './draft';

/** Atributos base (antes dos bônus), ou null se ainda não foram todos distribuídos. */
export function baseScores(draft: CharacterDraft): AbilityScores | null {
  if (draft.abilityMethod === 'pointBuy') return draft.pointBuy;
  if (!ABILITIES.every((a) => draft.abilityAssignment[a] !== undefined)) return null;
  return Object.fromEntries(
    ABILITIES.map((a) => [a, draft.abilityPool[draft.abilityAssignment[a]!]!]),
  ) as AbilityScores;
}

/**
 * Dados da Open5e + regras aplicadas às escolhas do rascunho.
 * Cada etapa usa só o que precisa; tudo vem do cache depois da primeira busca.
 */
export function useCreation() {
  const { draft } = useCharacterDraft();
  const edition = draft.edition;

  const abilitiesQ = useSrd('abilities', () => srd.abilities());
  const classQ = useSrd(draft.classKey && `class:${draft.classKey}`, () => srd.classDetail(draft.classKey!));
  const subclassesQ = useSrd(draft.classKey && `subclasses:${draft.classKey}`, () => srd.subclasses(draft.classKey!));
  const speciesQ = useSrd(edition && `species:${edition}`, () => srd.species(edition!));
  const backgroundsQ = useSrd(edition && `backgrounds:${edition}`, () => srd.backgrounds(edition!));
  const languagesQ = useSrd('languages', () => srd.languages());
  const featsQ = useSrd(edition && `feats:${edition}`, () => srd.feats(edition!));
  const itemsQ = useSrd(edition && `items:${edition}`, () => srd.items(edition!));

  // Sem useMemo manual: o React Compiler memoiza estes cálculos.
  const skills = abilitiesQ.status === 'ready' ? skillsFromAbilities(abilitiesQ.data) : null;
  const cls = classQ.status === 'ready' ? classQ.data : null;
  const klass = cls && skills ? classRules(cls, skills) : null;
  const subclasses = subclassesQ.status === 'ready' ? subclassesQ.data : [];
  /** Classes que escolhem a subclasse já no 1º nível (Clérigo, Feiticeiro e Bruxo de 2014). */
  const subclassAtLevel1 = !!cls && subclassesQ.status === 'ready' && subclasses.length > 0 && subclassLevel(subclasses, cls) === 1;
  const subclass = subclasses.find((s) => s.key === draft.subclassKey) ?? null;
  const speciesChain = speciesQ.status === 'ready' ? chainOf(speciesQ.data, draft.speciesKey) : [];

  const languages = languagesQ.status === 'ready' ? languagesQ.data : null;
  const species =
    speciesChain.length && skills && languages
      ? speciesRules(speciesChain, skills, languages.map((l) => l.name))
      : null;

  const background =
    backgroundsQ.status === 'ready' ? (backgroundsQ.data.find((b) => b.key === draft.backgroundKey) ?? null) : null;
  const bg = background && skills ? backgroundRules(background, skills) : null;

  const feats = featsQ.status === 'ready' ? featsQ.data : null;
  const backgroundFeat = bg?.feat && feats ? (feats.find((f) => f.name === bg.feat!.name) ?? null) : null;
  const originFeat = feats && draft.originFeatKey ? (feats.find((f) => f.key === draft.originFeatKey) ?? null) : null;

  // Iniciado em Magia (Clérigo/Mago…): lista de magias da classe citada.
  const magicInitiateClassKey =
    edition && bg?.feat?.name === 'Magic Initiate' && bg.feat.spellList
      ? DiferenteKey.build(edition, bg.feat.spellList.toLowerCase())
      : null;

  const base = baseScores(draft);
  // Bônus da raça na ordem (maiores primeiro): com a Origem Personalizada, cada um vai para o atributo escolhido.
  const originAmounts = Object.values(species?.abilityBonuses ?? {}).sort((a, b) => b - a);
  const customOrigin = edition === '2014' && draft.customOrigin && originAmounts.length > 0;
  const speciesBonus: Partial<Record<Ability, number>> = customOrigin
    ? Object.fromEntries(draft.originSlots.flatMap((a, i) => (a ? [[a, originAmounts[i]!]] : [])))
    : (species?.abilityBonuses ?? {});
  const originComplete = !customOrigin || draft.originSlots.filter(Boolean).length === originAmounts.length;
  const scores = base ? applyBonuses(base, speciesBonus, draft.bonusPicks) : null;

  const casting = klass?.spellcasting ?? null;
  const spellCount = casting && scores ? spellsToChoose(casting, scores) : (casting?.spells ?? 0);
  const needsSpells = !!casting || !!magicInitiateClassKey;

  /** Perícias que o personagem já tem sem escolher (antecedente e espécie). */
  // Origem Personalizada (Tasha): as perícias fixas da raça viram perícias à escolha.
  const swappedSpeciesSkills = customOrigin ? (species?.skills ?? []) : [];
  const speciesSkillChoice =
    swappedSpeciesSkills.length > 0
      ? { count: swappedSpeciesSkills.length + (species?.skillChoice?.count ?? 0), options: null }
      : (species?.skillChoice ?? null);
  const grantedSkills = [...new Set([...(bg?.skills ?? []), ...(customOrigin ? [] : (species?.skills ?? []))])];
  const allSkills = [
    ...new Set([...grantedSkills, ...draft.classSkills, ...draft.speciesSkills, ...draft.backgroundSkills]),
  ];

  // Idiomas: 2024 = Comum + 2 à escolha (Livro do Jogador 2024); 2014 = os da raça + extras da raça/antecedente.
  const fixedLanguages = languages
    ? edition === '2024'
      ? languages.filter((l) => l.key === 'common')
      : languages.filter((l) => species?.languages.includes(l.name))
    : [];
  const languagesNeeded = edition === '2024' ? 2 : (species?.extraLanguages ?? 0) + (bg?.languagesToChoose ?? 0);
  const languageOptions = (languages ?? []).filter(
    (l) => !l.is_secret && !fixedLanguages.some((f) => f.key === l.key),
  );

  const queries = { abilitiesQ, classQ, subclassesQ, speciesQ, backgroundsQ, languagesQ, featsQ, itemsQ };
  const items = itemsQ.status === 'ready' ? itemsQ.data : null;

  return {
    draft,
    queries,
    skills,
    cls,
    klass,
    subclasses,
    subclass,
    subclassAtLevel1,
    speciesChain,
    species,
    background,
    bg,
    feats,
    items,
    backgroundFeat,
    originFeat,
    magicInitiateClassKey,
    languages,
    base,
    speciesBonus,
    originAmounts,
    customOrigin,
    originComplete,
    scores,
    casting,
    spellCount,
    needsSpells,
    grantedSkills,
    swappedSpeciesSkills,
    speciesSkillChoice,
    allSkills,
    fixedLanguages,
    languagesNeeded,
    languageOptions,
  };
}

export type Creation = ReturnType<typeof useCreation>;

/** Espécie escolhida → [base] ou [base, subespécie]. */
function chainOf(groups: SrdSpeciesGroup[], speciesKey: string | null): SrdSpecies[] {
  if (!speciesKey) return [];
  for (const group of groups) {
    if (group.key === speciesKey) return [group];
    const sub = group.subspecies.find((s) => s.key === speciesKey);
    if (sub) return [group, sub];
  }
  return [];
}

/** Estado agregado de várias consultas: carregando se alguma carrega, erro se alguma falhou. */
export function combined(...states: { status: 'loading' | 'error' | 'ready'; retry: () => void }[]) {
  const failed = states.filter((s) => s.status === 'error');
  if (failed.length) return { status: 'error' as const, retry: () => failed.forEach((s) => s.retry()) };
  if (states.some((s) => s.status === 'loading')) return { status: 'loading' as const, retry: () => {} };
  return { status: 'ready' as const, retry: () => {} };
}
