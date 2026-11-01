import { expect, test } from 'bun:test';
import { createSrdCatalog } from './catalog';

test('consultas das duas edições ao mesmo tempo dividem a busca; depois, busca de novo', async () => {
  let calls = 0;
  const client = {
    GET: async () => {
      calls++;
      return { data: [], response: new Response(null, { status: 200 }) };
    },
  } as unknown as Parameters<typeof createSrdCatalog>[0];
  const srd = createSrdCatalog(client);

  await Promise.all([srd.feats('2014'), srd.feats('2024')]);
  expect(calls).toBe(1);

  await srd.feats('2014');
  expect(calls).toBe(2);
});
