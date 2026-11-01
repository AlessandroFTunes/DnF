import type PocketBaseClient from 'pocketbase';

/**
 * Narração (texto → fala). O app só conhece o port `Narration.Port`; cada provedor é um adapter. O provedor de
 * verdade (VoiceStudio, ElevenLabs…) roda no servidor, que guarda as chaves: `core/pb_hooks/tts.pb.js` tenta os
 * provedores de `TTS_PROVIDERS` em ordem, e cada um mora em `core/pb_hooks/tts/<nome>.js`. Trocar ou adicionar
 * provedor não muda nada aqui nem no app.
 */
export namespace Narration {
  /** `calm` é plana e pausada (avisos da subida de nível); `sage` tem mais entonação (o Grande Sábio). */
  export type Style = 'calm' | 'sage';

  /** Fala gerada: mp3 em base64, início de cada letra do texto (s) e duração (s). */
  export interface Result {
    audio: string;
    starts: number[];
    duration: number;
  }

  /** Port: gera a fala de `text`, ou `null` se não há narração (sem rede, sem provedor no servidor…). */
  export interface Port {
    synthesize(text: string, style: Style): Promise<Result | null>;
  }

  /** Port do cache de falas (arquivo no celular, Cache Storage na web). Nunca lança. */
  export interface Store {
    get(key: string): Promise<Result | undefined>;
    set(key: string, result: Result): Promise<void>;
  }

  /** Aumente para descartar as falas guardadas (ex.: trocou a voz ou o provedor padrão no servidor). */
  export const CACHE_VERSION = 1;

  /** Adapter: pede `/tts` ao PocketBase, que escolhe o provedor. Só atende logados. */
  export function createPocketBaseAdapter(pocketbase: PocketBaseClient): Port {
    return {
      async synthesize(text, style) {
        try {
          return await pocketbase.send<Result>('/tts', { query: { text, style }, requestKey: null });
        } catch {
          return null;
        }
      },
    };
  }

  /** A mesma fala já gerada sai do `store`, sem gastar créditos do provedor. */
  export function withCache(port: Port, store: Store): Port {
    return {
      async synthesize(text, style) {
        const key = style === 'calm' ? text : `${style}|${text}`;
        const saved = await store.get(key);
        if (saved) return saved;
        const result = await port.synthesize(text, style);
        if (result) void store.set(key, result);
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
