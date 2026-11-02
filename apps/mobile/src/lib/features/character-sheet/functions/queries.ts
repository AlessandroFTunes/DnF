import { useCallback } from 'react';
import { queryOptions, useMutation, useQuery } from '@tanstack/react-query';
import { Character } from '@dnf/core/character';
import { PLAYER_MAX_AGE, PLAYER_STALE_TIME, queryClient } from '../../../query-client';
import { useQueryState, type QueryState } from '../../../query-state';
import { mesaKeys } from '../../mesa/functions/queries';

/**
 * Consultas dos personagens (PocketBase). As telas só chamam estes hooks: `useCharacters()`, `useCharacter(id)`,
 * `useUpdateCharacter(id)`… Os dados são do jogador, então voltam a buscar depois de `PLAYER_STALE_TIME` e ficam
 * guardados no aparelho (ver `features/cache/functions/query-persister.ts`).
 */

export const characterKeys = {
  all: ['character'] as const,
  list: ['character', 'list'] as const,
  one: (id: string) => ['character', id] as const,
};

export type CharacterPatch = Omit<Parameters<typeof Character.update>[0], 'id'>;

const listOptions = () =>
  queryOptions({
    queryKey: characterKeys.list,
    queryFn: async () => (await Character.list({ pageSize: 100 })).data,
    staleTime: PLAYER_STALE_TIME,
    gcTime: PLAYER_MAX_AGE,
  });

const oneOptions = (id: string) =>
  queryOptions({
    queryKey: characterKeys.one(id),
    queryFn: () => Character.fromID(id),
    staleTime: PLAYER_STALE_TIME,
    gcTime: PLAYER_MAX_AGE,
    // Abrir a ficha pela Home já mostra o que a lista trouxe, enquanto a versão completa atualiza.
    initialData: () => queryClient.getQueryData<Character.Info[]>(characterKeys.list)?.find((c) => c.id === id),
    initialDataUpdatedAt: () => queryClient.getQueryState(characterKeys.list)?.dataUpdatedAt,
  });

/** Personagens do jogador logado. */
export function useCharacters(): QueryState<Character.Info[]> {
  return useQueryState(useQuery(listOptions()));
}

/** Um personagem; `null` quando não existe (ou o jogador não pode vê-lo). */
export function useCharacter(id: string): QueryState<Character.Info | null> {
  return useQueryState(useQuery(oneOptions(id)));
}

/** Aquece o cache da ficha (ex.: ao encostar no card na Home), para ela abrir pronta. */
export function usePrefetchCharacter() {
  return useCallback((id: string) => void queryClient.prefetchQuery(oneOptions(id)), []);
}

export function useCreateCharacter() {
  return useMutation({
    mutationFn: (input: Parameters<typeof Character.create>[0]) => Character.create(input),
    onSuccess: (created) => {
      queryClient.setQueryData(characterKeys.one(created.id), created);
      void queryClient.invalidateQueries({ queryKey: characterKeys.list });
    },
  }).mutateAsync;
}

export function useRemoveCharacter() {
  return useMutation({
    mutationFn: (id: string) => Character.remove(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: characterKeys.one(id) });
      void queryClient.invalidateQueries({ queryKey: characterKeys.list });
      // O personagem saiu das mesas em que estava.
      void queryClient.invalidateQueries({ queryKey: mesaKeys.all });
    },
  }).mutateAsync;
}

interface UpdateVariables {
  patch: CharacterPatch;
  /** Como a tela fica enquanto o servidor responde; se ele recusar, volta ao que era. */
  optimistic?: (c: Character.Info) => Character.Info;
}

/**
 * Salva uma mudança da ficha com atualização otimista: o cache muda na hora (a tela reage no toque) e volta atrás
 * se o servidor recusar. Sem rede a gravação espera e segue sozinha quando a conexão volta. `save` diz se salvou.
 */
export function useUpdateCharacter(id: string) {
  const key = characterKeys.one(id);
  const mutationKey = ['character-update', id] as const;
  const { mutateAsync, isPending } = useMutation({
    mutationKey,
    mutationFn: ({ patch }: UpdateVariables) => Character.update({ id, ...patch }),
    onMutate: async ({ optimistic }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Character.Info | null>(key);
      if (previous && optimistic) queryClient.setQueryData(key, optimistic(previous));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (updated) => {
      // Com outra gravação em andamento, a resposta desta ainda não tem a mudança dela: espera a última.
      if (queryClient.isMutating({ mutationKey }) <= 1) queryClient.setQueryData(key, updated);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: characterKeys.list });
      // Os PV e a ficha aparecem para o mestre na mesa.
      void queryClient.invalidateQueries({ queryKey: mesaKeys.all, predicate: (q) => q.queryKey[2] === 'members' });
    },
  });
  const save = useCallback(
    (patch: CharacterPatch, optimistic?: UpdateVariables['optimistic']) =>
      mutateAsync({ patch, optimistic }).then(
        () => true,
        () => false,
      ),
    [mutateAsync],
  );
  return { save, saving: isPending };
}
