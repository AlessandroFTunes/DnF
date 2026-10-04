import type { SrdTranslationSource } from '../../i18n';
import { CORE_NAMES } from './core';
import { ITEM_NAMES } from './items';
import { SPELL_NAMES } from './spells';

/** Nomes do SRD em português do Brasil. Descrições ainda não traduzidas (caem para o inglês). */
export const PT_BR: SrdTranslationSource = {
  byName: CORE_NAMES,
  byKind: { spell: SPELL_NAMES, item: ITEM_NAMES },
};
