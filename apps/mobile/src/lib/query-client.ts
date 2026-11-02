import { QueryClient } from '@tanstack/react-query';

/**
 * Cliente único do TanStack Query. Os dados do compêndio quase não mudam (e o disco guarda a cópia por 30 dias),
 * então ficam "frescos" para sempre na sessão: só buscam de novo com `retry()` ou quando a versão do cache muda.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, gcTime: Infinity, retry: 1, refetchOnWindowFocus: false },
  },
});
