import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { focusManager, onlineManager, QueryClient, type Query } from '@tanstack/react-query';

/**
 * Cliente único do TanStack Query. Dois tipos de dado:
 *  - compêndio (`['srd', …]`): quase não muda e o disco guarda a cópia por 30 dias, então fica "fresco" para
 *    sempre na sessão (`staleTime` infinito, padrão abaixo);
 *  - dados do jogador (`['character', …]`, `['mesa', …]`): `PLAYER_STALE_TIME` curto, voltam a buscar ao
 *    reabrir a tela, ao voltar o foco e ao reconectar, e são guardados no aparelho (ver `query-persister.ts`).
 */
export const PLAYER_STALE_TIME = 30 * 1000;
/** Quanto tempo um dado do jogador guardado no aparelho ainda vale ao abrir o app sem rede. */
export const PLAYER_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
/** Mude quando o formato de um personagem ou mesa mudar: o que estava guardado no aparelho é descartado. */
export const PLAYER_CACHE_VERSION = 'v1';

const PLAYER_ROOTS = new Set(['character', 'mesa']);

export const isPlayerQuery = (query: Pick<Query, 'queryKey'>) => PLAYER_ROOTS.has(String(query.queryKey[0]));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, gcTime: Infinity, retry: 1 },
  },
});

/** Esquece os dados do jogador (logout ou token recusado): o próximo usuário não pode ver os do anterior. */
export function clearPlayerData() {
  void queryClient.cancelQueries({ predicate: isPlayerQuery });
  queryClient.removeQueries({ predicate: isPlayerQuery });
  queryClient.getMutationCache().clear();
}

if (Platform.OS !== 'web') {
  // Fora da web o TanStack não enxerga a rede nem o foco do app: liga os dois ao NetInfo e ao AppState.
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false)),
  );
  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (state) => handleFocus(state === 'active'));
    return () => subscription.remove();
  });
}
