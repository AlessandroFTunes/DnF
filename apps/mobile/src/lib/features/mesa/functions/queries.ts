import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { Mesa } from '@dnf/core/mesa';
import { PLAYER_MAX_AGE, PLAYER_STALE_TIME, queryClient } from '../../../query-client';
import { useQueryState, type QueryState } from '../../../query-state';

/**
 * Consultas das mesas (PocketBase): `useMesas()`, `useMesa(id)`, `useMesaMembers(id)`, as ações (`useJoinMesa()`…) e o
 * realtime (`useMesaRealtime(id)`), que mantém o cache da mesa aberta atualizado.
 */

export const mesaKeys = {
  all: ['mesa'] as const,
  list: ['mesa', 'list'] as const,
  one: (id: string) => ['mesa', id] as const,
  members: (id: string) => ['mesa', id, 'members'] as const,
  ofCharacter: (characterID: string) => ['mesa', 'of-character', characterID] as const,
};

const base = { staleTime: PLAYER_STALE_TIME, gcTime: PLAYER_MAX_AGE };

/** Mesas em que o jogador é mestre ou participa. */
export function useMesas(): QueryState<Mesa.Info[]> {
  return useQueryState(
    useQuery(queryOptions({ ...base, queryKey: mesaKeys.list, queryFn: async () => (await Mesa.list({ pageSize: 100 })).data })),
  );
}

/** Uma mesa; `null` quando não existe. */
export function useMesa(id: string): QueryState<Mesa.Info | null> {
  return useQueryState(useQuery(queryOptions({ ...base, queryKey: mesaKeys.one(id), queryFn: () => Mesa.fromID(id) })));
}

/** Jogadores da mesa com os personagens (mestre: todos; jogador: só o próprio). */
export function useMesaMembers(id: string): QueryState<Mesa.Member[]> {
  return useQueryState(useQuery(queryOptions({ ...base, queryKey: mesaKeys.members(id), queryFn: () => Mesa.members(id) })));
}

/** Mesas em que um personagem está sentado. */
export function useMesasOfCharacter(characterID: string | undefined): QueryState<{ memberID: string; mesa: Mesa.Info }[]> {
  return useQueryState(
    useQuery(
      queryOptions({
        ...base,
        queryKey: mesaKeys.ofCharacter(characterID ?? ''),
        queryFn: () => Mesa.ofCharacter(characterID as string),
        enabled: !!characterID,
      }),
    ),
  );
}

/**
 * Mantém a mesa aberta atualizada pelo realtime do PocketBase (quem entra, sai ou muda o PV) enquanto a tela está em
 * foco. Cada aviso invalida a mesa e a lista de jogadores; a busca em andamento é reaproveitada. Sem realtime, fica
 * o que carregou e o "puxar para atualizar".
 */
export function useMesaRealtime(id: string) {
  useFocusEffect(
    useCallback(() => {
      let stop: (() => Promise<void>) | undefined;
      let closed = false;
      Mesa.watch(id, () => void queryClient.invalidateQueries({ queryKey: mesaKeys.one(id) })).then(
        (unsubscribe) => (closed ? void unsubscribe() : (stop = unsubscribe)),
        () => {},
      );
      return () => {
        closed = true;
        void stop?.();
      };
    }, [id]),
  );
}

export function useCreateMesa() {
  return useMutation({
    mutationFn: (input: Parameters<typeof Mesa.create>[0]) => Mesa.create(input),
    onSuccess: (created) => {
      queryClient.setQueryData(mesaKeys.one(created.id), created);
      void queryClient.invalidateQueries({ queryKey: mesaKeys.list });
    },
  }).mutateAsync;
}

/** Procura a mesa pelo código de convite (para mostrar nome e edição antes de entrar). */
export function useFindMesa() {
  return useMutation({ mutationFn: (code: string) => Mesa.fromInviteCode(code) }).mutateAsync;
}

export function useJoinMesa() {
  return useMutation({
    mutationFn: (input: Parameters<typeof Mesa.join>[0]) => Mesa.join(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: mesaKeys.all }),
  }).mutateAsync;
}

export function useRemoveMesa() {
  return useMutation({
    mutationFn: (id: string) => Mesa.remove(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: mesaKeys.one(id) });
      void queryClient.invalidateQueries({ queryKey: mesaKeys.all });
    },
  }).mutateAsync;
}

/** Troca o código de convite; o antigo para de funcionar. */
export function useNewInviteCode() {
  return useMutation({
    mutationFn: (id: string) => Mesa.newInviteCode(id),
    onSuccess: (updated) => queryClient.setQueryData(mesaKeys.one(updated.id), updated),
  }).mutateAsync;
}

/** O próprio jogador sai, ou o mestre remove alguém. */
export function useRemoveMember() {
  return useMutation({
    mutationFn: (memberID: string) => Mesa.removeMember(memberID),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: mesaKeys.all }),
  }).mutateAsync;
}
