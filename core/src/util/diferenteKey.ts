/**
 * Chaves do SRD na Open5e têm prefixo diferente por edição:
 * 2014 (5e) → `srd_goblin`, 2024 (5.5e) → `srd-2024_goblin-warrior`.
 * O slug pode ter `_` (ex.: features `srd-2024_wizard_arcane-recovery`), então só o primeiro `_` separa.
 */
export namespace DiferenteKey {
  export const EDITIONS = ['2014', '2024'] as const;
  export type Edition = (typeof EDITIONS)[number];

  const PREFIX: Record<Edition, string> = {
    '2014': 'srd',
    '2024': 'srd-2024',
  };

  export interface Parsed {
    edition: Edition;
    slug: string;
  }

  export function build(edition: Edition, slug: string): string {
    return `${PREFIX[edition]}_${slug}`;
  }

  /** `null` quando a chave não é do SRD (ex.: conteúdo da Kobold Press). */
  export function parse(key: string): Parsed | null {
    const sep = key.indexOf('_');
    if (sep <= 0) return null;
    const prefix = key.slice(0, sep);
    const edition = EDITIONS.find((e) => PREFIX[e] === prefix);
    return edition ? { edition, slug: key.slice(sep + 1) } : null;
  }

  /**
   * Mesma entidade na outra edição, trocando só o prefixo.
   * Não garante que exista: alguns nomes mudaram no 2024 (goblin → goblin-warrior).
   */
  export function toEdition(key: string, edition: Edition): string | null {
    const parsed = parse(key);
    return parsed ? build(edition, parsed.slug) : null;
  }
}
