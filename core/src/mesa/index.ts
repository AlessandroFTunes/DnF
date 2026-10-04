import { z } from 'zod';
import type { RecordModel } from 'pocketbase';
import { Assert } from '../util/assert';
import { DiferenteKey } from '../util/diferenteKey';
import { fn } from '../util/fn';
import { PocketBase, sortable } from '../pocketbase';
import { Common } from '../common';
import { Examples } from '../examples';
import { Character } from '../character';

/**
 * Mesa de jogo: por enquanto serve para o mestre acompanhar os personagens (PV) dos jogadores.
 * Quem pode o quê fica nas API rules do PocketBase (mestre lê os personagens da mesa dele;
 * para entrar o jogador precisa do código e de um personagem seu da mesma edição).
 */
export namespace Mesa {
  export const assert = Assert.create('Mesa');
  const assertSession = Assert.create('Session');

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

  /** Sortable keys mapped to what each orders by — also the allowlist. */
  export const SortableColumns = sortable(
    {
      name: 'name',
      timeCreated: 'created',
      timeUpdated: 'updated',
    } satisfies Partial<Record<keyof Info, string>>,
    '-updated,id',
  );

  export const create = fn(
    Info.pick({ name: true, edition: true }).extend({ description: Info.shape.description.default('') }),
    async (input) => {
      const pb = PocketBase.use();
      const gmID = await assertSession.exists(pb.authStore.record?.id);
      // O código é gerado pelo PocketBase (autogeneratePattern do campo).
      const record = await pb.collection('mesas').create({ ...input, gm: gmID });
      return serialize(record);
    },
    { title: 'Create table', description: 'Create a table with the logged-in user as game master.' },
  );

  export const list = fn(
    Common.Query({ sort: SortableColumns.schema.optional(), search: z.string().optional() }),
    async (input): Promise<Common.Page<Info>> => {
      const pb = PocketBase.use();
      const result = await pb.collection('mesas').getList(input.page, input.pageSize, {
        filter: input.search ? pb.filter('name ~ {:search}', { search: input.search }) : '',
        sort: SortableColumns.orderBy(input.sort),
      });
      return {
        data: result.items.map(serialize),
        page: result.page,
        pageSize: result.perPage,
        total: result.totalItems,
      };
    },
    {
      title: 'List tables',
      description: 'List tables the logged-in user runs or plays in. Paginated.',
    },
  );

  export const fromID = fn(
    Info.shape.id,
    (id) =>
      PocketBase.use()
        .collection('mesas')
        .getOne(id)
        .then(serialize, (error) => {
          if (error?.status === 404) return null;
          throw error;
        }),
    { title: 'Get table', description: 'Fetch a single table by id.' },
  );

  // A edição não muda: os personagens que já entraram são daquela edição.
  export const update = fn(
    Info.pick({ name: true, description: true }).partial().extend({ id: Info.shape.id }),
    async ({ id, ...patch }) => {
      await assert.exists(fromID.force(id));
      const record = await PocketBase.use().collection('mesas').update(id, patch);
      return serialize(record);
    },
    { title: 'Update table', description: "Update a table's name or description." },
  );

  export const remove = fn(
    Info.shape.id,
    async (id) => {
      await assert.exists(fromID.force(id));
      await PocketBase.use().collection('mesas').delete(id);
    },
    { title: 'Delete table', description: 'Permanently delete a table (characters are kept).' },
  );

  /** Troca o código de convite; o antigo para de funcionar. Quem já entrou continua. */
  export const newInviteCode = fn(
    Info.shape.id,
    async (id) => {
      await assert.exists(fromID.force(id));
      const record = await PocketBase.use().collection('mesas').update(id, { inviteCode: randomCode() });
      return serialize(record);
    },
    { title: 'New invite code', description: 'Replace the invite code; the old one stops working.' },
  );

  /** Mesa pelo código de convite (para mostrar nome e edição antes de entrar). */
  export const fromInviteCode = fn(
    InviteCode,
    async (inviteCode) => {
      const pb = PocketBase.use();
      // A regra de listagem só mostra a mesa a quem manda o código certo em `?code=`.
      const result = await pb
        .collection('mesas')
        .getList(1, 1, { filter: pb.filter('inviteCode = {:inviteCode}', { inviteCode }), code: inviteCode });
      return result.items[0] ? serialize(result.items[0]) : null;
    },
    { title: 'Find table by code', description: 'Look up a table by its invite code.' },
  );

  /** Mesas em que um personagem do usuário está. */
  export const ofCharacter = fn(
    Character.Info.shape.id,
    async (characterID): Promise<{ memberID: string; mesa: Info }[]> => {
      const pb = PocketBase.use();
      const records = await pb.collection('mesa_members').getFullList({
        filter: pb.filter('character = {:characterID}', { characterID }),
        expand: 'mesa',
        sort: 'created,id',
      });
      return records
        .filter((r) => r.expand?.mesa)
        .map((r) => ({ memberID: r.id, mesa: serialize(r.expand!.mesa) }));
    },
    { title: 'Tables of a character', description: 'Tables where one of your characters is seated.' },
  );

  export const join = fn(
    z.object({ inviteCode: InviteCode, characterID: Character.Info.shape.id }),
    async ({ inviteCode, characterID }) => {
      const pb = PocketBase.use();
      const userID = await assertSession.exists(pb.authStore.record?.id);
      // A regra de listagem só mostra a mesa a quem manda o código certo em `?code=`.
      const mesa = await assert.exists(
        pb
          .collection('mesas')
          .getList(1, 1, { filter: pb.filter('inviteCode = {:inviteCode}', { inviteCode }), code: inviteCode })
          .then((result) => result.items[0]),
      );
      const record = await pb
        .collection('mesa_members')
        .create(
          { mesa: mesa.id, user: userID, character: characterID, inviteCode },
          { expand: 'character' },
        );
      return serializeMember(record);
    },
    {
      title: 'Join table',
      description: 'Join a table with an invite code, bringing one of your characters of the same edition.',
    },
  );

  /** Mestre: todos os jogadores e personagens. Jogador: só a própria entrada. */
  export const members = fn(
    Info.shape.id,
    async (mesaID): Promise<Member[]> => {
      const pb = PocketBase.use();
      const records = await pb.collection('mesa_members').getFullList({
        filter: pb.filter('mesa = {:mesaID}', { mesaID }),
        expand: 'character',
        sort: 'created,id',
      });
      return records.map(serializeMember);
    },
    { title: 'List table members', description: 'Players at a table with their characters (HP etc.).' },
  );

  /** O próprio jogador sai, ou o mestre remove alguém. */
  export const removeMember = fn(
    Member.shape.id,
    async (memberID) => {
      await PocketBase.use()
        .collection('mesa_members')
        .delete(memberID)
        .catch((error) => {
          if (error?.status === 404) throw new Assert.NotFoundError('MesaMember');
          throw error;
        });
    },
    { title: 'Remove table member', description: 'Leave a table, or (game master) remove a player.' },
  );

  export function serialize(record: RecordModel): Info {
    return {
      id: record.id,
      gmID: record.gm,
      name: record.name,
      description: record.description,
      edition: record.edition,
      inviteCode: record.inviteCode,
      timeCreated: Common.toISO(record.created),
      timeUpdated: Common.toISO(record.updated),
    };
  }

  export function serializeMember(record: RecordModel): Member {
    return {
      id: record.id,
      mesaID: record.mesa,
      userID: record.user,
      character: Character.serialize(record.expand!.character),
      timeJoined: Common.toISO(record.created),
    };
  }

  // Mesmo alfabeto do autogeneratePattern do campo: sem 0/O e 1/I, que confundem ao digitar.
  const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  function randomCode(): string {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  }
}
