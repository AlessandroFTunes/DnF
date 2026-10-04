import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Ability, AbilityScores } from '@dnf/core/character';
import type { DiferenteKey } from '@dnf/core/util';

export type AbilityMethod = 'standard' | 'roll' | 'pointBuy';
/** 2024: o antecedente dá +2/+1 em dois atributos ou +1 em três. */
export type BonusMode = 'twoOne' | 'threeOnes';

/** Escolhas do jogador durante a criação; só vira personagem na revisão. */
export interface CharacterDraft {
  edition: DiferenteKey.Edition | null;
  classKey: string | null;
  /** Subclasse escolhida na criação (só quando a classe a recebe no 1º nível, ex.: Clérigo de 2014). */
  subclassKey: string | null;
  /** Espécie escolhida; em 2014 pode ser a subespécie (ex.: Hill Dwarf). */
  speciesKey: string | null;
  backgroundKey: string | null;

  abilityMethod: AbilityMethod;
  /** Valores para distribuir (conjunto padrão ou rolagem). */
  abilityPool: number[];
  /** Atributo → índice do valor em `abilityPool`. */
  abilityAssignment: Partial<Record<Ability, number>>;
  /** Compra por pontos: valor de cada atributo (8 a 15). */
  pointBuy: AbilityScores;
  bonusMode: BonusMode;
  /** Regra opcional do Caldeirão de Tasha (2014): mover os bônus de atributo da raça. */
  customOrigin: boolean;
  /** Para cada bônus da raça (na ordem, maiores primeiro), o atributo escolhido. */
  originSlots: (Ability | null)[];
  /** Bônus escolhidos pelo jogador: antecedente (2024) ou "+1 em dois à escolha" (Meio-elfo 2014). */
  bonusPicks: Partial<Record<Ability, number>>;

  /** Perícias escolhidas da lista da classe. */
  classSkills: string[];
  /** Perícias à escolha dadas pela espécie (Elfo 2024, Humano 2024, Meio-elfo 2014). */
  speciesSkills: string[];
  /** Perícias à escolha do antecedente (livros fora do SRD: "either X or Y"). */
  backgroundSkills: string[];
  /** Especialização (Ladino 1º nível). */
  expertise: string[];
  /** Talento de origem à escolha (Humano 2024). */
  originFeatKey: string | null;

  /** Grupo de equipamento da classe → opção escolhida ("A", "b"…). */
  classEquipment: Record<number, string>;
  backgroundEquipment: string | null;
  /** "grupo:opção:item" → chave da arma escolhida para "a martial weapon". */
  weaponPicks: Record<string, string>;

  cantrips: string[];
  spells: string[];
  /** Iniciado em Magia (talento de origem): 2 truques + 1 magia de 1º círculo. */
  featCantrips: string[];
  featSpell: string | null;

  /** Idiomas à escolha (os fixos vêm da espécie). */
  languages: string[];

  name: string;
  alignmentKey: string | null;
  personality: { traits: string; ideals: string; bonds: string; flaws: string };
  details: {
    age: string;
    height: string;
    weight: string;
    eyes: string;
    skin: string;
    hair: string;
    appearance: string;
    backstory: string;
  };
}

/** Conjunto padrão do Livro do Jogador (igual nas duas edições). */
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const ALL_EIGHT: AbilityScores = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };

const EMPTY: CharacterDraft = {
  edition: null,
  classKey: null,
  subclassKey: null,
  speciesKey: null,
  backgroundKey: null,
  abilityMethod: 'standard',
  abilityPool: STANDARD_ARRAY,
  abilityAssignment: {},
  pointBuy: ALL_EIGHT,
  bonusMode: 'twoOne',
  customOrigin: false,
  originSlots: [],
  bonusPicks: {},
  classSkills: [],
  speciesSkills: [],
  backgroundSkills: [],
  expertise: [],
  originFeatKey: null,
  classEquipment: {},
  backgroundEquipment: null,
  weaponPicks: {},
  cantrips: [],
  spells: [],
  featCantrips: [],
  featSpell: null,
  languages: [],
  name: '',
  alignmentKey: null,
  personality: { traits: '', ideals: '', bonds: '', flaws: '' },
  details: { age: '', height: '', weight: '', eyes: '', skin: '', hair: '', appearance: '', backstory: '' },
};

/** O que depende da classe (e some se ela mudar). */
const CLASS_DEPENDENT: Partial<CharacterDraft> = {
  subclassKey: null,
  classSkills: [],
  expertise: [],
  classEquipment: {},
  weaponPicks: {},
  cantrips: [],
  spells: [],
};

interface DraftContext {
  draft: CharacterDraft;
  update: (patch: Partial<CharacterDraft>) => void;
  /** Troca a edição; as chaves da Open5e são por edição, então as escolhas de regra são descartadas. */
  setEdition: (edition: DiferenteKey.Edition) => void;
  setClass: (classKey: string) => void;
  setSpecies: (speciesKey: string) => void;
  setBackground: (backgroundKey: string | null) => void;
  reset: () => void;
}

const Context = createContext<DraftContext | null>(null);

export function CharacterDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<CharacterDraft>(EMPTY);

  const value = useMemo<DraftContext>(() => {
    const update = (patch: Partial<CharacterDraft>) => setDraft((d) => ({ ...d, ...patch }));
    return {
      draft,
      update,
      setEdition: (edition) =>
        setDraft((d) =>
          d.edition === edition
            ? d
            : // Mantém o que não depende das regras: atributos base, nome e história.
              {
                ...EMPTY,
                edition,
                abilityMethod: d.abilityMethod,
                abilityPool: d.abilityPool,
                abilityAssignment: d.abilityAssignment,
                pointBuy: d.pointBuy,
                name: d.name,
                personality: d.personality,
                details: d.details,
              },
        ),
      setClass: (classKey) =>
        setDraft((d) => (d.classKey === classKey ? d : { ...d, ...CLASS_DEPENDENT, classKey })),
      setSpecies: (speciesKey) =>
        setDraft((d) =>
          d.speciesKey === speciesKey
            ? d
            : {
                ...d,
                speciesKey,
                speciesSkills: [],
                originFeatKey: null,
                languages: [],
                originSlots: [],
                bonusPicks: d.edition === '2014' ? {} : d.bonusPicks,
              },
        ),
      setBackground: (backgroundKey) =>
        setDraft((d) =>
          d.backgroundKey === backgroundKey
            ? d
            : {
                ...d,
                backgroundKey,
                backgroundEquipment: null,
                backgroundSkills: [],
                featCantrips: [],
                featSpell: null,
                bonusPicks: d.edition === '2024' ? {} : d.bonusPicks,
              },
        ),
      reset: () => setDraft(EMPTY),
    };
  }, [draft]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useCharacterDraft(): DraftContext {
  const context = useContext(Context);
  if (!context) throw new Error('useCharacterDraft precisa estar dentro de CharacterDraftProvider.');
  return context;
}
