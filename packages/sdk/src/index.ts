import PocketBase from 'pocketbase';

// A URL é configurável para suportar tanto o servidor central quanto o self-hosted do mestre.
export function createClient(serverUrl: string) {
  return new PocketBase(serverUrl);
}

export type DnfClient = ReturnType<typeof createClient>;
