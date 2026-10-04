/**
 * Helpers para escrever o conteúdo dos livros (Guia de Xanathar, Caldeirão de Tasha) no formato das
 * coleções `srd_*` do complemento. A mecânica é a do livro; o texto é nosso (resumo em inglês + pt-BR).
 */

export const BOOKS = {
  xge: 'DnF · Guia de Xanathar para Todas as Coisas (mecânica do livro, texto próprio)',
  tce: 'DnF · Caldeirão de Tasha para Todas as Coisas (mecânica do livro, texto próprio)',
} as const;

export type Book = keyof typeof BOOKS;

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const base = (book: Book, slug: string, name: string) => ({
  key: `${book}_${slug}`,
  name,
  edition: '2014',
  document_key: book,
  document_name: BOOKS[book],
});

/** [níveis, nome, nome pt-BR, texto, texto pt-BR] */
export type FeatureSpec = [number | number[], string, string, string, string];

export interface SubclassSpec {
  cls: string;
  name: string;
  pt: string;
  desc: string;
  ptDesc: string;
  features: FeatureSpec[];
}

export function subclass(book: Book, spec: SubclassSpec) {
  const slug = slugify(spec.name);
  const key = `${book}_${slug}`;
  const features = spec.features.map(([levels, name, , desc]) => ({
    key: `${key}_${slugify(name)}`,
    name,
    desc,
    feature_type: 'CLASS_LEVEL_FEATURE',
    gained_at: (Array.isArray(levels) ? levels : [levels]).map((level) => ({ level, detail: null })),
    data_for_class_table: [],
  }));
  return {
    ...base(book, slug, spec.name),
    subclass_of: spec.cls,
    desc: spec.desc,
    features,
    i18n: {
      'pt-BR': {
        name: spec.pt,
        desc: spec.ptDesc,
        features: Object.fromEntries(spec.features.map(([, , ptName, , ptDesc], i) => [features[i]!.key, [ptName, ptDesc]])),
      },
    },
  };
}

export interface SpellSpec {
  name: string;
  pt: string;
  level: number;
  school: string;
  classes: string[];
  /** action | bonus-action | reaction | 1minute | 10minutes | 1hour | 8hours | 24hours */
  time: string;
  range: string;
  duration: string;
  /** "V", "VS", "VSM"… */
  comp: string;
  material?: string;
  conc?: boolean;
  ritual?: boolean;
  attack?: boolean;
  save?: string;
  dmg?: string;
  desc: string;
  ptDesc: string;
  higher?: string;
  ptHigher?: string;
}

export function spell(book: Book, s: SpellSpec) {
  return {
    ...base(book, slugify(s.name), s.name),
    desc: s.desc,
    level: s.level,
    school: s.school,
    classes: s.classes,
    casting_time: s.time,
    range_text: s.range,
    duration: s.duration,
    concentration: !!s.conc,
    ritual: !!s.ritual,
    verbal: s.comp.includes('V'),
    somatic: s.comp.includes('S'),
    material: s.comp.includes('M'),
    material_specified: s.material ?? '',
    attack_roll: !!s.attack,
    saving_throw_ability: s.save ?? '',
    damage_roll: s.dmg ?? '',
    higher_level: s.higher ?? '',
    i18n: { 'pt-BR': { name: s.pt, desc: s.ptDesc, ...(s.ptHigher ? { higher_level: s.ptHigher } : {}) } },
  };
}

export interface FeatSpec {
  name: string;
  pt: string;
  prerequisite?: string;
  desc: string;
  ptDesc: string;
  /** [texto, texto pt-BR] */
  benefits: [string, string][];
}

export function feat(book: Book, f: FeatSpec) {
  return {
    ...base(book, slugify(f.name), f.name),
    type: 'General',
    prerequisite: f.prerequisite ?? '',
    desc: f.desc,
    benefits: f.benefits.map(([desc]) => ({ desc })),
    i18n: { 'pt-BR': { name: f.pt, desc: f.ptDesc, benefits: f.benefits.map(([, pt]) => pt) } },
  };
}
