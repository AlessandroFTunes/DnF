/** Edições de regras: `2014` (5e) e `2024` (5.5e). Na 5e-FastAPI, `fonte.edicao` é `5e` ou `5.5e`. */
export namespace DiferenteKey {
  export const EDITIONS = ['2014', '2024'] as const;
  export type Edition = (typeof EDITIONS)[number];
}
