import { z } from 'zod';
import { fn } from '../util/fn';
import { Http } from '../http';
import { Common } from '../common';

/**
 * Grid de combate: a imagem de um mapa (no NAS) + a cena em cima dela.
 * A tabela `grids` guarda só nome, url e mesa; posições, desenhos, paredes, luzes e fog ficam num JSON
 * (`grid_scenes.data`, o `Scene` abaixo). Todas as medidas são em pixels da imagem do mapa, para o
 * desenho não depender do renderer nem do zoom. Só o mestre lê e escreve.
 */
export namespace Grid {
  /** Imagem do mapa: PNG, JPG, WebP ou GIF. */
  export const MAP_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const;

  export const Info = z
    .object({
      id: z.string().meta({ description: Common.IdDescription }),
      mesaID: z.string().meta({ description: 'Id of the table this grid belongs to.' }),
      name: z.string().trim().min(1).max(64).meta({ description: 'Grid name.' }),
      url: z
        .string()
        .trim()
        .min(1)
        .max(255)
        .refine(
          (url) => MAP_EXTENSIONS.includes(url.split('.').pop()?.toLowerCase() as (typeof MAP_EXTENSIONS)[number]),
          'The map must be a PNG, JPG, WebP or GIF image.',
        )
        .meta({ description: 'Path of the map image in the NAS storage (e.g. "<mesaID>/mapas/taverna.png").' }),
      timeCreated: z.iso.datetime().meta({ description: 'When it was created.' }),
      timeUpdated: z.iso.datetime().meta({ description: 'When it was last updated.' }),
    })
    .meta({ ref: 'Grid', description: 'A battle map of a table.' });
  export type Info = z.infer<typeof Info>;

  //-----------------------------------------------------------------------------------
  // Cena (o JSON). Versionada: se o formato mudar, `parseScene` migra o que está salvo.

  const Id = z.string().min(1).max(40);
  const Point = z.tuple([z.number(), z.number()]).meta({ description: '[x, y] in map pixels.' });
  const Color = z.string().regex(/^#[0-9a-f]{6}$/i);

  export const Token = z.object({
    id: Id,
    name: z.string().max(64),
    x: z.number(),
    y: z.number(),
    /** Lado em células (1 = médio, 2 = grande…). */
    size: z.number().min(0.5).max(12).default(1),
    color: Color.default('#d94f4f'),
    /** Imagem do token no NAS (opcional). */
    image: z.string().max(255).nullable().default(null),
    /** Só o mestre vê. */
    hidden: z.boolean().default(false),
    /** Personagem de jogador: enxerga e ilumina o fog dinâmico. */
    player: z.boolean().default(false),
    /** Raio de visão em pés (0 = não enxerga por si; veja luzes). */
    vision: z.number().min(0).default(0),
    /** Luz que o token carrega (tocha etc.), em pés. */
    light: z.object({ bright: z.number().min(0), dim: z.number().min(0), color: Color.default('#ffd9a0') }).nullable().default(null),
  });
  export type Token = z.infer<typeof Token>;

  /** Segmento que bloqueia (ou não) visão e luz. */
  export const Wall = z.object({
    id: Id,
    a: Point,
    b: Point,
    kind: z.enum(['wall', 'door', 'window']).default('wall'),
    /** Porta aberta deixa passar luz e visão. */
    open: z.boolean().default(false),
  });
  export type Wall = z.infer<typeof Wall>;

  export const Light = z.object({
    id: Id,
    x: z.number(),
    y: z.number(),
    bright: z.number().min(0),
    dim: z.number().min(0),
    color: Color.default('#ffd9a0'),
  });
  export type Light = z.infer<typeof Light>;

  export const Drawing = z.object({
    id: Id,
    tool: z.enum(['pen', 'line', 'rect', 'ellipse', 'text']),
    /** pen: todos os pontos; line/rect/ellipse: dois (início e fim); text: um. */
    points: z.array(Point).min(1).max(5000),
    color: Color.default('#ffffff'),
    width: z.number().min(1).max(64).default(4),
    text: z.string().max(200).optional(),
    /** Só o mestre vê. */
    hidden: z.boolean().default(false),
  });
  export type Drawing = z.infer<typeof Drawing>;

  export const Scene = z
    .object({
      version: z.literal(1).default(1),
      cell: z
        .object({
          /** Lado da célula em pixels do mapa. */
          size: z.number().min(8).max(1000).default(70),
          offsetX: z.number().default(0),
          offsetY: z.number().default(0),
          /** Quanto vale uma célula, em pés (5 em D&D). */
          feet: z.number().min(1).default(5),
          show: z.boolean().default(true),
          color: Color.default('#ffffff'),
        })
        .default({ size: 70, offsetX: 0, offsetY: 0, feet: 5, show: true, color: '#ffffff' }),
      tokens: z.array(Token).max(500).default([]),
      walls: z.array(Wall).max(5000).default([]),
      lights: z.array(Light).max(200).default([]),
      drawings: z.array(Drawing).max(2000).default([]),
      fog: z
        .object({
          enabled: z.boolean().default(false),
          /** Áreas que o mestre revelou à mão (polígonos). */
          revealed: z.array(z.array(Point).min(3)).max(500).default([]),
          /** Áreas que o mestre escondeu de novo, por cima do que foi revelado. */
          hidden: z.array(z.array(Point).min(3)).max(500).default([]),
        })
        .default({ enabled: false, revealed: [], hidden: [] }),
      lighting: z
        .object({
          /** Liga a iluminação dinâmica (paredes, luzes e visão dos tokens). */
          enabled: z.boolean().default(false),
          /** 0 = escuridão total, 1 = tudo iluminado. */
          ambient: z.number().min(0).max(1).default(0),
        })
        .default({ enabled: false, ambient: 0 }),
    })
    .meta({ ref: 'GridScene', description: 'Everything drawn on top of a grid map.' });
  export type Scene = z.infer<typeof Scene>;

  /** Lê o JSON salvo; preenche o que faltar e descarta o que não for da cena. */
  export function parseScene(data: unknown): Scene {
    return Scene.parse(data && typeof data === 'object' ? data : {});
  }

  //-----------------------------------------------------------------------------------
  // CRUD (só o mestre da mesa lê e escreve; o servidor decide: `core/src/api/grids.ts`)

  /** `null` quando a grid não existe ou o usuário não é o mestre da mesa dela. */
  const orNull = (error: unknown) => {
    if (error instanceof Http.ApiError && error.status === 404) return null;
    throw error;
  };

  export const Create = Info.pick({ name: true, url: true });
  export const Patch = Create.partial();

  export const create = fn(
    Create.extend({ mesaID: Info.shape.mesaID }),
    ({ mesaID, ...body }) => Http.client().request<Info>(`/mesas/${mesaID}/grids`, { method: 'POST', body }),
    { title: 'Create grid', description: 'Create a battle map with an image already stored in the NAS.' },
  );

  export const list = fn(
    Info.shape.mesaID,
    (mesaID) => Http.client().request<Info[]>(`/mesas/${mesaID}/grids`),
    { title: 'List grids', description: 'Battle maps of a table, most recently changed first.' },
  );

  export const fromID = fn(
    Info.shape.id,
    (id) => Http.client().request<Info>(`/grids/${id}`).catch(orNull),
    { title: 'Get grid', description: 'Fetch a single grid by id.' },
  );

  export const update = fn(
    Patch.extend({ id: Info.shape.id }),
    ({ id, ...body }) => Http.client().request<Info>(`/grids/${id}`, { method: 'PATCH', body }),
    { title: 'Update grid', description: "Rename a grid or swap its map image." },
  );

  export const remove = fn(
    Info.shape.id,
    (id) => Http.client().request<void>(`/grids/${id}`, { method: 'DELETE' }),
    { title: 'Delete grid', description: 'Delete a grid and its scene.' },
  );

  //-----------------------------------------------------------------------------------
  // Cena

  /** A cena da grid; uma grid nova ainda não tem registro e volta com os padrões. */
  export const scene = fn(
    Info.shape.id,
    async (gridID): Promise<Scene> => {
      const { scene } = await Http.client().request<{ scene: unknown }>(`/grids/${gridID}/scene`);
      return parseScene(scene);
    },
    { title: 'Get scene', description: 'Tokens, walls, lights, drawings and fog of a grid.' },
  );

  export const SceneBody = z.object({ scene: Scene });

  /** Troca a cena inteira (valida antes de gravar). */
  export const saveScene = fn(
    SceneBody.extend({ gridID: Info.shape.id }),
    async ({ gridID, scene }) => {
      await Http.client().request<void>(`/grids/${gridID}/scene`, { method: 'PUT', body: { scene } });
      return scene;
    },
    { title: 'Save scene', description: 'Replace the whole scene of a grid.' },
  );
}

export * from './visibility';
