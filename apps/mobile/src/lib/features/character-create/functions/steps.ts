import type { Href } from 'expo-router';
import { useCreation } from './useCreation';

/** Etapas da criação, na ordem. A escolha de edição vem antes e não conta como etapa. */
export const STEP_DEFS = [
  { id: 'class', label: 'Classe', href: '/character/new/class' },
  { id: 'species', label: 'Espécie', href: '/character/new/species' },
  { id: 'background', label: 'Antecedente', href: '/character/new/background' },
  { id: 'abilities', label: 'Atributos', href: '/character/new/abilities' },
  { id: 'skills', label: 'Perícias', href: '/character/new/skills' },
  { id: 'equipment', label: 'Equipamento', href: '/character/new/equipment' },
  { id: 'spells', label: 'Magias', href: '/character/new/spells' },
  { id: 'details', label: 'Identidade', href: '/character/new/details' },
  { id: 'story', label: 'História', href: '/character/new/story' },
  { id: 'review', label: 'Revisão', href: '/character/new/review' },
] as const satisfies readonly { id: string; label: string; href: Href }[];

export type StepId = (typeof STEP_DEFS)[number]['id'];
export type Step = (typeof STEP_DEFS)[number];

/** Etapas valendo para o rascunho atual (sem "Magias" para quem não conjura no 1º nível). */
export function useSteps(): readonly Step[] {
  const { needsSpells, klass, draft } = useCreation();
  // Enquanto a classe carrega, mantém a etapa para a barra de progresso não pular.
  const known = !!draft.classKey && klass !== null;
  return STEP_DEFS.filter((s) => s.id !== 'spells' || needsSpells || !known);
}
