import { z } from 'zod';
import {
  BaseAuthStore,
  getTokenPayload,
  type AuthRecord,
  type RecordModel,
} from 'pocketbase';
import { Assert } from '../util/assert';
import { fn } from '../util/fn';
import { PocketBase, sortable } from '../pocketbase';
import { Common } from '../common';
import { Examples } from '../examples';

export namespace User {
  export const assert = Assert.create('User');

  // Mantenha em sincronia com o mínimo do campo `password` da collection users no PocketBase.
  export const PASSWORD_MIN_LENGTH = 8;

  /** Ajustes do app, guardados no campo JSON `preferences`. Tudo liga por padrão; campo novo entra com padrão. */
  export const Preferences = z.object({
    narration: z.boolean().default(true).meta({ description: 'Spoken narration (narrator and Grande Sábio).' }),
    sounds: z.boolean().default(true).meta({ description: 'Sound effects (level-up celebration).' }),
  });
  export type Preferences = z.infer<typeof Preferences>;

  export const Info = z
    .object({
      id: z.string().meta({ description: Common.IdDescription, example: Examples.User.id }),
      email: z.string().meta({
        description: 'Login email. Empty when not visible to the requester (emailVisibility).',
      }),
      name: z.string().trim().min(1).max(64).meta({ description: 'Display name.' }),
      nickname: z.string().trim().max(32).meta({
        description: 'Nickname shown to other players instead of the name. Empty for none.',
      }),
      avatar: z.string().nullable().meta({ description: 'Avatar image URL, or null for none.' }),
      preferences: Preferences.meta({ description: 'Per-user app settings (narration, sounds…).' }),
      verified: z.boolean().meta({ description: 'Whether the email was confirmed.' }),
      timeCreated: z.iso.datetime().meta({ description: 'When it was created.' }),
      timeUpdated: z.iso.datetime().meta({ description: 'When it was last updated.' }),
    })
    .meta({
      ref: 'User',
      description: 'A player or game master account.',
      example: Examples.User,
    });
  export type Info = z.infer<typeof Info>;

  // Email e senha têm fluxos próprios no PocketBase (confirmação / senha antiga).
  const Patch = Info.pick({ name: true, nickname: true })
    .extend({ preferences: Preferences.partial() })
    .partial();

  // Normaliza antes de validar: o autocompletar do teclado costuma deixar espaço no fim.
  export const Email = z.string().trim().toLowerCase().pipe(z.email());
  export const Password = z.string().min(PASSWORD_MIN_LENGTH).max(71); // 71 = limite do bcrypt no PocketBase

  /** Sortable keys mapped to what each orders by — also the allowlist. */
  export const SortableColumns = sortable(
    {
      name: 'name',
      timeCreated: 'created',
    } satisfies Partial<Record<keyof Info, string>>,
    'name,id',
  );

  export const create = fn(
    z
      .object({
        name: Info.shape.name,
        email: Email,
        password: Password,
        passwordConfirm: z.string(),
      })
      .refine((data) => data.password === data.passwordConfirm, {
        path: ['passwordConfirm'],
        message: 'As senhas não conferem',
      }),
    async (input) => {
      const record = await PocketBase.use().collection('users').create(input);
      // Sem login a resposta omite o email (emailVisibility); quem criou já sabe qual é.
      return { ...serialize(record), email: input.email };
    },
    { title: 'Create user', description: 'Sign up a new account with email and password.' },
  );

  /** Resposta de `lookupEmail`: a rota só devolve isto, nunca o registro do usuário. */
  export const EmailLookup = z.object({
    exists: z.boolean(),
    firstName: z.string().nullable().optional(),
  });
  export type EmailLookup = z.infer<typeof EmailLookup>;

  /**
   * Se já existe conta com o email e, se sim, o primeiro nome dela (para o "Bem-vindo de volta").
   * Rota `/api/dnf/email-exists`, em core/pb_hooks/auth.pb.js.
   */
  export const lookupEmail = fn(
    z.object({ email: Email }),
    async ({ email }) => {
      const res = await PocketBase.use().send('/api/dnf/email-exists', { method: 'POST', body: { email } });
      // Filtra de novo aqui: campo a mais que o servidor mande não passa para o app.
      return EmailLookup.parse(res);
    },
    { title: 'Look up email', description: 'Whether an account uses this email, and its first name.' },
  );

  export const list = fn(
    Common.Query({ sort: SortableColumns.schema.optional(), search: z.string().optional() }),
    async (input): Promise<Common.Page<Info>> => {
      const pb = PocketBase.use();
      const result = await pb.collection('users').getList(input.page, input.pageSize, {
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
      title: 'List users',
      description: 'List users visible to the requester (by default, only themself). Paginated.',
    },
  );

  export const fromID = fn(
    Info.shape.id,
    (id) =>
      PocketBase.use()
        .collection('users')
        .getOne(id)
        .then(serialize, (error) => {
          if (error?.status === 404) return null;
          throw error;
        }),
    { title: 'Get user', description: 'Fetch a single user by id.' },
  );

  export const update = fn(
    Patch.extend({ id: Info.shape.id }),
    async ({ id, ...patch }) => {
      await assert.exists(fromID.force(id));
      const data: Record<string, unknown> = { ...patch };
      // As preferências são um JSON só: junta com as atuais para mudar uma sem perder as outras.
      if (patch.preferences) {
        const current = await assert.exists(fromID.force(id));
        data.preferences = Preferences.parse({ ...current.preferences, ...patch.preferences });
      }
      const record = await PocketBase.use().collection('users').update(id, data);
      return serialize(record);
    },
    { title: 'Update user', description: "Update a user's name, nickname or preferences (merged with the current)." },
  );

  /** Imagem do avatar: um `Blob` (web) ou o arquivo escolhido no celular (`uri`, `name` e `type`). */
  export type AvatarFile = Blob | { uri: string; name: string; type: string };
  export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
  export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

  /** Troca o avatar: o arquivo fica no storage do próprio PocketBase (campo `avatar` da coleção users). */
  export async function setAvatar(id: string, file: AvatarFile): Promise<Info> {
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) throw new Error('Use uma imagem JPEG, PNG ou WebP.');
    if (file instanceof Blob && file.size > AVATAR_MAX_BYTES) throw new Error('A imagem passa de 5 MB.');
    const form = new FormData();
    // No React Native o FormData aceita o objeto { uri, name, type } no lugar de um Blob.
    form.append('avatar', file as Blob);
    return serialize(await PocketBase.use().collection('users').update(id, form));
  }

  export async function removeAvatar(id: string): Promise<Info> {
    return serialize(await PocketBase.use().collection('users').update(id, { avatar: null }));
  }

  /** Como o jogador aparece para os outros: o apelido, ou o nome se não tiver. */
  export const displayName = (user: Pick<Info, 'name' | 'nickname'>) => user.nickname || user.name;

  /** Apaga a conta de vez. Se for a do usuário logado, encerra a sessão. */
  export const remove = fn(
    Info.shape.id,
    async (id) => {
      await assert.exists(fromID.force(id));
      const pb = PocketBase.use();
      await pb.collection('users').delete(id);
      if (pb.authStore.record?.id === id) pb.authStore.clear();
    },
    { title: 'Delete user', description: 'Permanently delete a user account.' },
  );

  // ---------------------------------------------------------------------------
  // Sessão (os detalhes ficam no namespace privado `Session`, abaixo)
  // ---------------------------------------------------------------------------

  /** Armazenamento seguro do dispositivo (Keychain/Keystore no mobile). Implementado por cada app. */
  export type SessionStorage = Session.Storage;
  export type SessionInfo = Session.Info;

  /** Sessão atual, ou null se não há login válido. */
  export function session(): SessionInfo | null {
    return Session.info(PocketBase.use().authStore);
  }

  /** AuthStore para passar ao PocketBase: persiste só o token no `storage`. */
  export function createAuthStore(storage: SessionStorage): BaseAuthStore {
    return new Session.SecureAuthStore(storage);
  }

  /**
   * Lê o token salvo no armazenamento seguro para a memória, sem falar com o servidor.
   * Quando e como renovar fica com o app (ver hook.session.ts no mobile).
   */
  export async function loadSession(): Promise<SessionInfo | null> {
    await Session.load(PocketBase.use().authStore);
    return session();
  }

  export function serialize(record: RecordModel): Info {
    return {
      id: record.id,
      email: record.email ?? '',
      name: record.name,
      nickname: record.nickname ?? '',
      avatar: record.avatar ? PocketBase.use().files.getURL(record, record.avatar, { thumb: '256x256' }) : null,
      preferences: Preferences.catch(() => Preferences.parse({})).parse(record.preferences ?? {}),
      verified: record.verified,
      timeCreated: Common.toISO(record.created),
      timeUpdated: Common.toISO(record.updated),
    };
  }
}

/** Privado: detalhes de como a sessão é guardada no dispositivo. */
namespace Session {
  const KEY = 'dnf.session.token';

  // O token em si fica de fora de propósito: não deve chegar na UI nem em logs.
  export const Info = z
    .object({
      userID: z.string().meta({ description: 'Id of the logged-in user (read from the token).' }),
      user: User.Info.nullable().meta({
        description: 'Profile from the server, or null until it is loaded (e.g. app opened offline).',
      }),
      timeExpires: z.iso.datetime().meta({ description: 'When the token expires.' }),
    })
    .meta({
      ref: 'Session',
      description: 'The current login session on this device.',
      example: {
        userID: Examples.User.id,
        user: Examples.User,
        timeExpires: '2026-11-03T05:24:30.000Z',
      },
    });
  export type Info = z.infer<typeof Info>;

  export function info(store: BaseAuthStore): Info | null {
    if (!store.isValid) return null;
    const payload = getTokenPayload(store.token);
    return {
      userID: payload.id,
      user: store.record ? User.serialize(store.record) : null,
      timeExpires: new Date(payload.exp * 1000).toISOString(),
    };
  }

  export interface Storage {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }

  /**
   * AuthStore do PocketBase que persiste SOMENTE o token.
   * O registro do usuário fica em memória e é recarregado no `authRefresh`
   * (o Keychain pode rejeitar valores grandes e não precisa guardar dados de perfil).
   */
  export class SecureAuthStore extends BaseAuthStore {
    constructor(private readonly storage: Storage) {
      super();
    }

    override save(token: string, record?: AuthRecord): void {
      super.save(token, record);
      this.storage.setItem(KEY, token).catch(reportStorageError);
    }

    override clear(): void {
      super.clear();
      this.storage.removeItem(KEY).catch(reportStorageError);
    }

    /** Carrega o token salvo para a memória, sem validar com o servidor. */
    async load(): Promise<void> {
      const token = await this.storage.getItem(KEY);
      if (token) super.save(token, null);
    }
  }

  export async function load(store: BaseAuthStore) {
    if (store instanceof SecureAuthStore) await store.load();
  }

  function reportStorageError(error: unknown) {
    console.warn('[session] falha ao acessar o armazenamento seguro', error);
  }
}
