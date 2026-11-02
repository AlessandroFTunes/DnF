import { useCallback, useMemo, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import type { QueryKey } from '@tanstack/react-query';
import { queryClient } from './query-client';

/**
 * Forma única que as telas leem de qualquer consulta: `loading` / `error` / `ready`.
 * `ready` vale também com dado antigo na tela enquanto uma nova busca falha (sem rede, por exemplo).
 * `retry` tenta de novo; `refresh` é o mesmo, mas devolve a Promise (para o "puxar para atualizar").
 */
export type QueryState<T> =
  | { status: 'loading'; retry: () => void; refresh: () => Promise<unknown> }
  | { status: 'error'; retry: () => void; refresh: () => Promise<unknown> }
  | { status: 'ready'; data: T; retry: () => void; refresh: () => Promise<unknown> };

/** O objeto só muda quando o status ou o dado mudam (estável para `useMemo`/efeitos das telas). */
export function useQueryState<T>(query: {
  status: 'pending' | 'error' | 'success';
  data: T | undefined;
  refetch: () => Promise<unknown>;
}): QueryState<T> {
  const { status, data, refetch } = query;
  return useMemo(() => {
    const refresh = () => refetch();
    const retry = () => void refetch();
    if (data !== undefined) return { status: 'ready', data, retry, refresh };
    return { status: status === 'error' ? 'error' : 'loading', retry, refresh };
  }, [status, data, refetch]);
}

/**
 * Ao voltar para a tela (ela fica montada na pilha), busca de novo as consultas de `queryKey` que já passaram do
 * `staleTime`. A primeira exibição não conta: quem monta já busca.
 */
export function useRefetchOnFocus(queryKey: QueryKey) {
  const key = useRef(queryKey);
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      void queryClient.refetchQueries({ queryKey: key.current, stale: true, type: 'active' });
    }, []),
  );
}
