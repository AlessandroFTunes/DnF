import { z } from 'zod';
import { DiferenteKey } from '../util/diferenteKey';
import { fn } from '../util/fn';
import { Http } from '../http';
import { Common } from '../common';
import { Examples } from '../examples';
import { Character } from '../character';
import { Nas } from '../storage';

/**
 * Mesa de jogo: por enquanto serve para o mestre acompanhar os personagens (PV) dos jogadores.
 * Quem pode o quê o servidor decide (`core/src/api/mesas.ts`): o mestre lê os personagens da mesa dele; para entrar,
 * o jogador precisa do código e de um personagem seu da mesma edição.
 */
export namespace Mesa {
  export const Info = z
    .object({
      id: z.string().meta({ description: Common.IdDescription, example: Examples.Mesa.id }),
      gmID: z.string().meta({ description: 'Id of the game master (owner).' }),
      name: z.string().trim().min(1).max(64).meta({ description: 'Table name.' }),
      description: z.string().trim().max(2000).meta({ description: 'Free text for the players.' }),
      edition: z.enum(DiferenteKey.EDITIONS).meta({
        description: 'Rules edition; characters must use the same one.',
      }),
      inviteCode: z.string().meta({ description: 'Code players use to join.' }),
      cover: z.string().nullable().meta({
        description: 'Path of the cover image in the NAS storage (e.g. "<mesaID>/imagens/capa.png"), or null for none.',
      }),
      timeCreated: z.iso.datetime().meta({ description: 'When it was created.' }),
      timeUpdated: z.iso.datetime().meta({ description: 'When it was last updated.' }),
    })
    .meta({ ref: 'Mesa', description: 'A game table run by a game master.', example: Examples.Mesa });
  export type Info = z.infer<typeof Info>;

  export const Member = z
    .object({
      id: z.string().meta({ description: Common.IdDescription, example: Examples.MesaMember.id }),
      mesaID: z.string().meta({ description: 'Id of the table.' }),
      userID: z.string().meta({ description: 'Id of the player.' }),
      playerName: z.string().meta({ description: 'How the player appears to others: nickname, or name.' }),
      character: Character.Info.meta({ description: 'Character the player brought to the table.' }),
      timeJoined: z.iso.datetime().meta({ description: 'When the player joined.' }),
    })
    .meta({
      ref: 'MesaMember',
      description: 'A player at a table, with their character.',
      example: Examples.MesaMember,
    });
  export type Member = z.infer<typeof Member>;

  /** Aceita o código como o jogador digitar: minúsculas, espaços e traços (ex.: "k7q2-xmh4"). */
  export const InviteCode = z
    .string()
    .transform((code) => code.replace(/[^a-z0-9]/gi, '').toUpperCase())
    .pipe(z.string().length(8));

  export const Sort = z.enum(['name', '-name', 'timeCreated', '-timeCreated', 'timeUpdated', '-timeUpdated']);

  export const ListQuery = Common.Query({ sort: Sort.optional(), search: z.string().optional() });

  export const Create = Info.pick({ name: true, edition: true }).extend({ description: Info.shape.description.default('') });

  // A edição não muda: os personagens que já entraram são daquela edição.
  export const Patch = Info.pick({ name: true, description: true, cover: true }).partial();

  export const create = fn(
    Create,
    (input) => Http.client().request<Info>('/mesas', { method: 'POST', body: input }),
    { title: 'Create table', description: 'Create a table with the logged-in user as game master.' },
  );

  export const list = fn(
    ListQuery,
    (input) => Http.client().request<Common.Page<Info>>('/mesas', { query: input }),
    { title: 'List tables', description: 'List tables the logged-in user runs or plays in. Paginated.' },
  );

  /** `null` quando a mesa não existe ou o usuário não pode vê-la. */
  const orNull = (error: unknown) => {
    if (error instanceof Http.ApiError && error.status === 404) return null;
    throw error;
  };

  export const fromID = fn(
    Info.shape.id,
    (id) => Http.client().request<Info>(`/mesas/${id}`).catch(orNull),
    { title: 'Get table', description: 'Fetch a single table by id.' },
  );

  export const update = fn(
    Patch.extend({ id: Info.shape.id }),
    ({ id, ...patch }) => Http.client().request<Info>(`/mesas/${id}`, { method: 'PATCH', body: patch }),
    { title: 'Update table', description: "Update a table's name, description or cover." },
  );

  export const remove = fn(
    Info.shape.id,
    (id) => Http.client().request<void>(`/mesas/${id}`, { method: 'DELETE' }),
    { title: 'Delete table', description: 'Permanently delete a table (characters are kept).' },
  );

  /** Troca o código de convite; o antigo para de funcionar. Quem já entrou continua. */
  export const newInviteCode = fn(
    Info.shape.id,
    (id) => Http.client().request<Info>(`/mesas/${id}/invite-code`, { method: 'POST' }),
    { title: 'New invite code', description: 'Replace the invite code; the old one stops working.' },
  );

  /** Mesa pelo código de convite (para mostrar nome e edição antes de entrar). */
  export const fromInviteCode = fn(
    InviteCode,
    (inviteCode) => Http.client().request<Info>(`/mesas/by-code/${inviteCode}`).catch(orNull),
    { title: 'Find table by code', description: 'Look up a table by its invite code.' },
  );

  /** Mesas em que um personagem do usuário está. */
  export const ofCharacter = fn(
    Character.Info.shape.id,
    (characterID) =>
      Http.client().request<{ memberID: string; mesa: Info }[]>(`/mesas/of-character/${characterID}`),
    { title: 'Tables of a character', description: 'Tables where one of your characters is seated.' },
  );

  export const JoinInput = z.object({ inviteCode: InviteCode, characterID: Character.Info.shape.id });

  export const join = fn(
    JoinInput,
    (input) => Http.client().request<Member>('/mesas/join', { method: 'POST', body: input }),
    {
      title: 'Join table',
      description: 'Join a table with an invite code, bringing one of your characters of the same edition.',
    },
  );

  /** Mestre: todos os jogadores e personagens. Jogador: só a própria entrada. */
  export const members = fn(
    Info.shape.id,
    (mesaID) => Http.client().request<Member[]>(`/mesas/${mesaID}/members`),
    { title: 'List table members', description: 'Players at a table with their characters (HP etc.).' },
  );

  /**
   * Avisa (`onChange`) quando a mesa, a lista de membros ou um personagem dela muda (SSE, `GET /mesas/:id/events`).
   * Cada um só recebe aviso das mesas que pode ver. Também avisa a cada (re)conexão, para quem ficou sem rede buscar
   * o que perdeu. Devolve a função que para de ouvir.
   */
  export async function watch(mesaID: string, onChange: () => void): Promise<() => Promise<void>> {
    const http = Http.client();
    let source: EventSource | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    // O bilhete vale 60 s e o `EventSource` não manda cabeçalhos: a cada conexão pede um novo.
    const connect = async () => {
      try {
        const { ticket } = await http.request<{ ticket: string }>('/auth/ticket', { method: 'POST' });
        if (stopped) return;
        source = new EventSource(http.url(`/mesas/${mesaID}/events`, { ticket }));
        source.addEventListener('open', onChange);
        source.addEventListener('change', onChange);
        source.addEventListener('error', () => {
          source?.close();
          if (!stopped) timer = setTimeout(connect, 3_000);
        });
      } catch {
        if (!stopped) timer = setTimeout(connect, 5_000);
      }
    };
    await connect();

    return async () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    };
  }

  /** O próprio jogador sai, ou o mestre remove alguém. */
  export const removeMember = fn(
    Member.shape.id,
    (memberID) => Http.client().request<void>(`/mesas/members/${memberID}`, { method: 'DELETE' }),
    { title: 'Remove table member', description: 'Leave a table, or (game master) remove a player.' },
  );

  /** Guarda a capa da mesa no NAS (imagem, até 30 MB). `url` é o caminho dentro da pasta do NAS. */
  export async function adicionarCapa(url: string, arquivo: Blob) {
    const data = await Nas.save({ url, file: arquivo });
    return data;
  }
}
