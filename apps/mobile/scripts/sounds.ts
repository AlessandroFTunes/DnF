/// <reference types="node" />
/**
 * Gera os efeitos sonoros da celebração de subir de nível com a ElevenLabs (text-to-sound-effects) e grava em
 * assets/sounds. Os arquivos vão junto com o app: rode só para trocar um efeito (ajuste o prompt abaixo).
 *
 *   bun run sounds            # gera todos
 *   bun run sounds burst      # só um
 *
 * Lê ELEVENLABS_API_KEY do .env da raiz.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Tudo soa dentro de uma caverna, como a narração (reverb `tunnel` em core/pb_hooks/tts.pb.js).
const CAVE = ', echoing inside a vast stone cave';

const SOUNDS: Record<string, { text: string; seconds: number; loop?: boolean }> = {
  // Fundo de toda a celebração, em loop e baixo.
  ambience: {
    text: 'Deep underground cave ambience, distant water drips echoing, low hollow wind, faint magical crystal shimmer, mysterious, no music',
    seconds: 10,
    loop: true,
  },
  // Subida comum: o dado estoura em faíscas (BURST_AT).
  burst: {
    text: 'Instant magical level up burst, bright crystalline chime explosion with a sparkling shimmer tail, fantasy RPG, starts immediately' + CAVE,
    seconds: 2.5,
  },
  // Multiclasse: o d20 vermelho e o azul se chocam (COLLIDE_AT).
  collide: {
    text: 'Two crystal dice clashing together, short whoosh into a deep resonant magical crystal impact with sparkling tail, fantasy' + CAVE,
    seconds: 3,
  },
  // Nível 20: o dado treme antes de quebrar (SHAKE_AT até SHATTER_AT).
  shake: {
    text: 'Rising magical energy rumble, crystal trembling and building tension, short riser' + CAVE,
    seconds: 1,
  },
  // Nível 20: o dado se quebra (SHATTER_AT) e nasce o herói lendário.
  shatter: {
    text: 'Magical crystal shattering into pieces, glass explosion followed by a triumphant heavenly choir swell, epic legendary fantasy, starts immediately' + CAVE,
    seconds: 4,
  },
};

const key = process.env.ELEVENLABS_API_KEY;
if (!key) throw new Error('Falta ELEVENLABS_API_KEY no .env da raiz.');

const only = process.argv.slice(2);
for (const [name, sound] of Object.entries(SOUNDS)) {
  if (only.length && !only.includes(name)) continue;
  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: sound.text, duration_seconds: sound.seconds, loop: sound.loop ?? false, prompt_influence: 0.5 }),
  });
  if (!res.ok) throw new Error(`${name}: ${res.status} ${await res.text()}`);
  await writeFile(join(__dirname, '../assets/sounds', `${name}.mp3`), Buffer.from(await res.arrayBuffer()));
  console.log(`${name}.mp3`);
}
