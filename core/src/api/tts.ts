import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import type { Narration } from '../narration';
import { Db } from '../db';
import type { Env } from './index';

/**
 * Narração: `GET /tts?text=…` (narrador) e `GET /tts/sage?text=…` (Grande Sábio). Devolvem
 * `{ audio (base64), format, starts, duration }` (`Narration.Result`). Cada provedor é um adapter com `available()`
 * e um comando só, `createVoice(text)`, com a voz padrão fixa aqui (do ambiente vem só a chave/endereço).
 * Narrador: provedores de `TTS_PROVIDERS` (padrão `elevenlabs`), em ordem. Sábio: `elevenlabs-sage`, `piper` e
 * os do narrador. Se um cai, tenta o próximo. A fala do provedor principal fica na tabela `tts_cache`.
 */
interface Provider {
  available(): boolean;
  createVoice(text: string): Promise<Narration.Result>;
}

/** Aumente para descartar as falas guardadas (trocou a voz ou os ajustes de um adapter). */
const CACHE_VERSION = 1;
const MAX_TEXT = 600;

const VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku'; // Lily
const MODEL_ID = 'eleven_multilingual_v2';
const AUDIO_EFFECTS = { environment_id: 'hall', distance: 0.1, send_level: 0.45 };

type VoiceSettings = { stability: number; similarity_boost: number; style: number; use_speaker_boost: boolean; speed: number };

function elevenLabs(env: Env, settings: VoiceSettings): Provider {
  return {
    available: () => !!env.ELEVENLABS_API_KEY,
    async createVoice(text) {
      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/with-timestamps?output_format=mp3_44100_128`,
        {
          method: 'POST',
          headers: { 'xi-api-key': env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, model_id: MODEL_ID, voice_settings: settings, audio_effects: AUDIO_EFFECTS }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
      const json = (await res.json()) as {
        audio_base64: string;
        alignment?: { character_start_times_seconds: number[]; character_end_times_seconds: number[] };
      };
      const starts = json.alignment?.character_start_times_seconds ?? [];
      const ends = json.alignment?.character_end_times_seconds ?? [];
      return { audio: json.audio_base64, format: 'mp3', starts, duration: ends.at(-1) ?? 0 };
    },
  };
}

function piper(env: Env): Provider {
  return {
    available: () => !!env.PIPER_URL,
    async createVoice(text) {
      // O Piper do NAS gera mais ou menos em tempo real: uma fala longa leva alguns segundos.
      const res = await fetch(`${env.PIPER_URL!.replace(/\/+$/, '')}/tts?text=${encodeURIComponent(text)}`, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) throw new Error(`Piper ${res.status}: ${await res.text()}`);
      return (await res.json()) as Narration.Result;
    },
  };
}

function providers(env: Env): Record<string, Provider> {
  return {
    // Narrador: estabilidade alta e estilo zero, sem emoção, sempre igual.
    elevenlabs: elevenLabs(env, { stability: 0.9, similarity_boost: 0.8, style: 0, use_speaker_boost: true, speed: 0.92 }),
    // Grande Sábio: a mesma voz, mais solta, para a entonação seguir a pontuação do roteiro.
    'elevenlabs-sage': elevenLabs(env, { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true, speed: 0.95 }),
    piper: piper(env),
  };
}

function narratorProviders(env: Env): string[] {
  return (env.TTS_PROVIDERS || 'elevenlabs')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

export function ttsRoutes(env: Env) {
  const db = Db.use();
  const all = providers(env);
  const app = new Hono();

  async function speak(voice: string, names: string[], text: string) {
    const key = createHash('sha256').update(`${CACHE_VERSION}|${voice}|${text}`).digest('hex');
    const { ttsCache } = Db.tables;
    const [saved] = await db.select().from(ttsCache).where(eq(ttsCache.key, key)).limit(1);
    if (saved) return { status: 200, body: saved.result };

    const errors: string[] = [];
    for (const name of names) {
      const provider = all[name];
      if (!provider?.available()) continue;
      try {
        const result = await provider.createVoice(text);
        // Só a fala do provedor principal é guardada: a de uma reserva não fica no lugar dela.
        if (name === names[0]) await db.insert(ttsCache).values({ key, result }).onConflictDoNothing();
        return { status: 200, body: result };
      } catch (error) {
        errors.push(`${name}: ${error}`);
        console.warn('tts: provedor falhou', name, String(error));
      }
    }
    if (!errors.length) return { status: 503, body: { message: 'Narração desligada: nenhum provedor configurado.' } };
    return { status: 502, body: { message: 'Todos os provedores de voz falharam.', errors } };
  }

  const handler = (voice: string, first: string[]) => async (c: import('hono').Context) => {
    const text = (c.req.query('text') ?? '').trim();
    // Limite para ninguém gastar os créditos com textos longos.
    if (!text || text.length > MAX_TEXT) return c.json({ message: `Texto vazio ou maior que ${MAX_TEXT} caracteres.` }, 400);
    const names = [...first, ...narratorProviders(env).filter((name) => !first.includes(name))];
    const { status, body } = await speak(voice, names, text);
    return c.json(body, status as 200);
  };

  app.get('/tts', handler('narrator', []));
  app.get('/tts/sage', handler('sage', ['elevenlabs-sage', 'piper']));
  return app;
}
