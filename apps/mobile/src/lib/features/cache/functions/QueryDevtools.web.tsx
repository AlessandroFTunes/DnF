import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

/** Painel do cache do TanStack Query (só em desenvolvimento, na web). */
export function QueryDevtools() {
  return __DEV__ ? <ReactQueryDevtools initialIsOpen={false} /> : null;
}
