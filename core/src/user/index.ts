import { z } from 'zod';
import { fn } from '../util/fn';
import { Http } from '../http';
import { Common } from '../common';
import { Examples } from '../examples';

export namespace User {
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

  // Email e senha têm fluxos próprios (não passam pelo update do perfil).
  export const Patch = Info.pick({ name: true, nickname: true })
    // `.partial()` do Zod 4 ainda aplica os padrões (`{ sounds: false }` religaria a narração): campo ausente fica ausente.
    .extend({ preferences: z.object({ narration: z.boolean().optional(), sounds: z.boolean().optional() }) })
    .partial();

  // Normaliza antes de validar: o autocompletar do teclado costuma deixar espaço no fim.
  export const Email = z.string().trim().toLowerCase().pipe(z.email());
  export const Password = z.string().min(PASSWORD_MIN_LENGTH).max(71); // 71 = limite do bcrypt

  /** Resposta de `lookupEmail`: a rota só devolve isto, nunca o registro do usuário. */
  export const EmailLookup = z.object({
    exists: z.boolean(),
    firstName: z.string().nullable().optional(),
  });
  export type EmailLookup = z.infer<typeof EmailLookup>;

  export const SignUp = z
    .object({
      name: Info.shape.name,
      email: Email,
      password: Password,
      passwordConfirm: z.string(),
    })
    .refine((data) => data.password === data.passwordConfirm, {
      path: ['passwordConfirm'],
      message: 'As senhas não conferem',
    });

  export const Login = z.object({ email: Email, password: z.string().min(1) });

  /** O que o servidor devolve ao entrar: o token da sessão e o perfil (com o avatar como caminho da API). */
  export interface Granted {
    token: string;
    user: Info;
  }

  /** O avatar vem do servidor como caminho (`/files/avatars/…`); aqui vira o endereço completo. */
  function withAvatarURL(user: Info): Info {
    return { ...user, avatar: user.avatar ? Http.client().url(user.avatar) : null };
  }

  /** Guarda o login no `AuthStore` (o token vai para o Keychain; o perfil fica em memória). */
  function start({ token, user }: Granted): Info {
    const profile = withAvatarURL(user);
    Http.client().auth.save(token, profile);
    return profile;
  }

  export const create = fn(
    SignUp,
    async (input) => start(await Http.client().request<Granted>('/auth/signup', { method: 'POST', body: input })),
    { title: 'Create user', description: 'Sign up a new account with email and password, and log in.' },
  );

  export const login = fn(
    Login,
    async (input) => start(await Http.client().request<Granted>('/auth/login', { method: 'POST', body: input })),
    { title: 'Login', description: 'Authenticate with email and password.' },
  );

  /** Renova o token e o perfil. Quem decide o que fazer com um token recusado é o app (ver hook.session.ts). */
  export async function refresh(): Promise<Info> {
    return start(await Http.client().request<Granted>('/auth/refresh', { method: 'POST' }));
  }

  /** Encerra a sessão aqui e no servidor (o cookie da web é httpOnly: só ele consegue apagá-lo). */
  export async function logout(): Promise<void> {
    const http = Http.client();
    const hadToken = !!http.auth.token;
    http.auth.clear();
    if (hadToken) await http.request('/auth/logout', { method: 'POST' }).catch(() => {});
  }

  /**
   * Se já existe conta com o email e, se sim, o primeiro nome dela (para o "Bem-vindo de volta").
   * Rota aberta: o servidor devolve só isto.
   */
  export const lookupEmail = fn(
    z.object({ email: Email }),
    async ({ email }) =>
      // Filtra de novo aqui: campo a mais que o servidor mande não passa para o app.
      EmailLookup.parse(await Http.client().request('/auth/email-exists', { method: 'POST', body: { email } })),
    { title: 'Look up email', description: 'Whether an account uses this email, and its first name.' },
  );

  /** Depois de mudar o próprio perfil, a sessão (que o app lê) passa a mostrar o perfil novo. */
  function keep(user: Info): Info {
    const profile = withAvatarURL(user);
    const auth = Http.client().auth;
    auth.save(auth.token, profile);
    return profile;
  }

  export const update = fn(
    Patch.extend({ id: Info.shape.id }),
    async ({ id, ...patch }) => keep(await Http.client().request<Info>(`/users/${id}`, { method: 'PATCH', body: patch })),
    { title: 'Update user', description: "Update a user's name, nickname or preferences (merged with the current)." },
  );

  /** Imagem do avatar: um `Blob` (web) ou o arquivo escolhido no celular (`uri`, `name` e `type`). */
  export type AvatarFile = Blob | { uri: string; name: string; type: string };
  export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
  export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

  /** Troca o avatar: o servidor guarda o arquivo (JPEG, PNG ou WebP, até 5 MB). */
  export async function setAvatar(id: string, file: AvatarFile): Promise<Info> {
    if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) throw new Error('Use uma imagem JPEG, PNG ou WebP.');
    if (file instanceof Blob && file.size > AVATAR_MAX_BYTES) throw new Error('A imagem passa de 5 MB.');
    const form = new FormData();
    // No React Native o FormData aceita o objeto { uri, name, type } no lugar de um Blob.
    form.append('avatar', file as Blob);
    return keep(await Http.client().request<Info>(`/users/${id}/avatar`, { method: 'PUT', body: form }));
  }

  export async function removeAvatar(id: string): Promise<Info> {
    return keep(await Http.client().request<Info>(`/users/${id}/avatar`, { method: 'DELETE' }));
  }

  /** Apaga a conta de quem está logado (personagens, mesas e grids dele vão junto) e encerra a sessão. */
  export const remove = fn(
    Info.shape.id,
    async (id) => {
      await Http.client().request<void>(`/users/${id}`, { method: 'DELETE' });
      Http.client().auth.clear();
    },
    { title: 'Delete user', description: 'Permanently delete the logged-in account.' },
  );

  /** Como o jogador aparece para os outros: o apelido, ou o nome se não tiver. */
  export const displayName = (user: Pick<Info, 'name' | 'nickname'>) => user.nickname || user.name;

  // ---------------------------------------------------------------------------
  // Sessão

  /** Armazenamento seguro do dispositivo (Keychain/Keystore no mobile). Implementado por cada app. */
  export type SessionStorage = Http.Storage;

  // O token em si fica de fora de propósito: não deve chegar na UI nem em logs.
  export const SessionInfo = z
    .object({
      userID: z.string().meta({ description: 'Id of the logged-in user (read from the token).' }),
      user: Info.nullable().meta({
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
  export type SessionInfo = z.infer<typeof SessionInfo>;

  /** Sessão atual, ou null se não há login válido. */
  export function session(): SessionInfo | null {
    const store = Http.client().auth as Http.AuthStore<Info>;
    const payload = store.isValid ? Http.tokenPayload(store.token) : null;
    if (!payload) return null;
    return { userID: payload.id, user: store.record, timeExpires: new Date(payload.exp * 1000).toISOString() };
  }

  /** AuthStore para passar ao `Http.init`: persiste só o token no `storage`. */
  export function createAuthStore(storage: SessionStorage): Http.AuthStore<Info> {
    return new Http.AuthStore<Info>(storage);
  }

  /**
   * Lê o token salvo no armazenamento seguro para a memória, sem falar com o servidor.
   * Quando e como renovar fica com o app (ver hook.session.ts no mobile).
   */
  export async function loadSession(): Promise<SessionInfo | null> {
    await Http.client().auth.load();
    return session();
  }
}
