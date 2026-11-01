import type PocketBaseClient from 'pocketbase';

/**
 * Narração (texto → fala). O app só conhece o port `Narration.Port`; cada provedor é um adapter. O provedor de
 * verdade (ElevenLabs, Piper…) roda no servidor, que guarda as chaves: `core/pb_hooks/tts.pb.js` tenta os
 * provedores de `TTS_PROVIDERS` em ordem, e cada um mora em `core/pb_hooks/tts/<nome>.js`. Trocar ou adicionar
 * provedor não muda nada aqui nem no app.
 */
export namespace Narration {
  /** Fala gerada: áudio em base64, início de cada letra do texto (s) e duração (s). */
  export interface Result {
    audio: string;
    /** Formato do áudio; sem o campo, mp3 (respostas e cache de antes do Piper). */
    format?: 'mp3' | 'wav';
    starts: number[];
    duration: number;
  }

  /** Port: um comando só, "criar voz". Gera a fala de `text` na voz padrão, ou `null` se não há narração. */
  export interface Port {
    createVoice(text: string): Promise<Result | null>;
  }

  /** Port do cache de falas (arquivo no celular, Cache Storage na web). Nunca lança. */
  export interface Store {
    get(key: string): Promise<Result | undefined>;
    set(key: string, result: Result): Promise<void>;
  }

  /**
   * Aumente para descartar as falas guardadas (ex.: trocou a voz padrão ou o provedor no servidor).
   *  2: o Grande Sábio voltou para a ElevenLabs (as falas dele geradas pelo Piper saem do cache)
   */
  export const CACHE_VERSION = 2;

  /**
   * Adapter: pede a fala ao PocketBase, que escolhe o provedor. Cada voz é uma rota: `/tts` (narrador) e
   * `/tts/sage` (Grande Sábio). Só atende logados.
   */
  export function createPocketBaseAdapter(pocketbase: PocketBaseClient, route: '/tts' | '/tts/sage' = '/tts'): Port {
    return {
      async createVoice(text) {
        try {
          return await pocketbase.send<Result>(route, { query: { text }, requestKey: null });
        } catch {
          return null;
        }
      },
    };
  }

  /** A mesma fala já gerada sai do `store`, sem gastar créditos do provedor. `prefix` separa as falas de cada voz. */
  export function withCache(port: Port, store: Store, prefix = ''): Port {
    return {
      async createVoice(text) {
        const saved = await store.get(prefix + text);
        if (saved) return saved;
        const result = await port.createVoice(text);
        if (result) void store.set(prefix + text, result);
        return result;
      },
    };
  }

  /** Quando cada trecho de `marks` começa a ser dito (ms), na ordem; `null` se o trecho não está no texto. */
  export function marksMs(text: string, marks: string[], result: Result): (number | null)[] {
    let from = 0;
    return marks.map((mark) => {
      const i = text.indexOf(mark, from);
      if (i < 0) return null;
      from = i + mark.length;
      return Math.round((result.starts[i] ?? 0) * 1000);
    });
  }

  /** Nome curto e seguro para o texto da fala (hash djb2 + tamanho). */
  export function hash(text: string): string {
    let h = 5381;
    for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
    return `${h.toString(36)}-${text.length}`;
  }
}
