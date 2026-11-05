import { useMutation } from '@tanstack/react-query';
import { User } from '@dnf/core/user';
import { useSession } from '../../auth/functions/hook.session';

/**
 * Perfil do jogador logado. O registro do usuário já mora na sessão (o PocketBase o atualiza sozinho a cada
 * `update` do próprio usuário), então ler é só olhar a sessão; gravar são as ações abaixo.
 */

export const DEFAULT_PREFERENCES: User.Preferences = User.Preferences.parse({});

/** Preferências de fora de um componente (ex.: decidir se a narração toca). Sem sessão, os padrões. */
export function currentPreferences(): User.Preferences {
  return User.session()?.user?.preferences ?? DEFAULT_PREFERENCES;
}

/** `user` é `null` até o perfil chegar do servidor (app aberto sem rede). */
export function useProfile() {
  const session = useSession();
  if (session.status !== 'signedIn') return { userID: null, user: null, email: '' };
  const { userID, user } = session.session;
  return { userID, user, email: user?.email ?? '' };
}

export function usePreferences(): User.Preferences {
  return useProfile().user?.preferences ?? DEFAULT_PREFERENCES;
}

function useUserID() {
  const { userID } = useProfile();
  return () => {
    if (!userID) throw new Error('Sem sessão.');
    return userID;
  };
}

/** Nome, apelido e preferências (cada preferência é mesclada com as atuais). */
export function useUpdateProfile() {
  const id = useUserID();
  return useMutation({
    mutationFn: (patch: Omit<Parameters<typeof User.update>[0], 'id'>) => User.update({ id: id(), ...patch }),
  }).mutateAsync;
}

export function useSetAvatar() {
  const id = useUserID();
  return useMutation({ mutationFn: (file: User.AvatarFile) => User.setAvatar(id(), file) }).mutateAsync;
}

export function useRemoveAvatar() {
  const id = useUserID();
  return useMutation({ mutationFn: () => User.removeAvatar(id()) }).mutateAsync;
}
