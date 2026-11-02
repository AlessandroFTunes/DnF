import { createSrdCatalog, createSrdClient } from '@dnf/sdk/srd';
import Constants from 'expo-constants';
import { Cache } from '@dnf/core/cache';
import { PocketBase } from '@dnf/core/pocketbase';
import { persistentCache } from '../../cache/functions/persistent-cache';
import '../../../pocketbase';

/**
 * Compêndio de regras: a 5e-FastAPI (dados em português). O app não fala direto com ela: passa pelo
 * PocketBase (`core/pb_hooks/srd.pb.js`), que guarda o token do Cloudflare Access e só atende logados.
 * `EXPO_PUBLIC_DND_API_URL` aponta para outra instância (ex.: uma API local, sem login).
 */
// No celular (Expo Go), "localhost" é o próprio celular: troca pelo IP da máquina que roda o Metro.
const devHost = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
// Vazia conta como ausente (o `bun phone` zera para passar pelo PocketBase).
const directUrl = process.env.EXPO_PUBLIC_DND_API_URL?.replace('//localhost', `//${devHost}`) || undefined;

const client = createSrdClient(directUrl ? { baseUrl: directUrl } : { pocketbase: PocketBase.client() });

export const srd = createSrdCatalog(client);

/**
 * Os textos da API já vêm em português; `tr` só mantém a forma das telas (`tr.name(classe)`) caso um dia
 * entre outro idioma.
 */
export const tr = {
  locale: 'pt-BR' as const,
  name: (entity: { name: string }, _kind?: string) => entity.name,
  desc: (entity: { desc?: string | null }) => entity.desc ?? '',
  text: (text: string, _kind?: string) => text,
  field: (_key: string, _field: string, fallback: string) => fallback,
};

/**
 * Versão dos dados do compêndio guardados no aparelho. AUMENTE sempre que o SDK mudar o que uma
 * consulta devolve: ao abrir, o app apaga o cache antigo inteiro e busca de novo.
 *  1: primeira versão
 *  2: subclasses das duas edições em cada classe
 *  3: subclasses e magias do Guia de Xanathar e do Caldeirão de Tasha (complemento)
 *  4: troca da Open5e pela 5e-FastAPI
 *  5: característica repetida em níveis maiores (Golpe Brutal Fortalecido 13 e 17) vira uma só
 *  6: talentos, equipamento e magias dos três livros carregados (o cache tinha as listas vazias); Artífice na criação 2024
 *  7: classes e subclasses com `casting` (conjuração para a multiclasse)
 *  8: ferramentas com `variants` (proficiência de ferramenta da multiclasse)
 */
export const SRD_CACHE_VERSION = 8;
export const cache = Cache.create(persistentCache, SRD_CACHE_VERSION);

/** Chave da consulta no TanStack Query. */
export const srdKey = (key: string) => ['srd', key] as const;
