import { z } from 'zod';
import { fn } from '../util/fn';

/**
 * Guarda arquivos (imagem, vídeo, PDF) no disco do NAS. Só roda no servidor.
 * A "url" é o caminho dentro da pasta raiz (ex.: "mesas/abc/capa.png"); quem serve o arquivo
 * depois (nginx, rota do app) usa o mesmo caminho. A raiz vem de `NAS_DIR` (padrão `./nas`).
 */
type Builtins = {
  'node:fs/promises': typeof import('node:fs/promises');
  'node:path': typeof import('node:path');
};

/**
 * `node:fs` e `node:path` só são pegos na hora de usar, sem `import`: assim o `Mesa` (que o app mobile
 * importa) pode usar o `Nas` sem o bundler do Expo tentar resolver módulos do Node.
 */
function node<K extends keyof Builtins>(id: K): Builtins[K] {
  const load = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }).process
    ?.getBuiltinModule;
  if (!load) throw new Error('Nas só funciona no servidor (Node 22+ ou Bun).');
  return load(id) as Builtins[K];
}

export namespace Nas {
  export const MAX_BYTES = 30 * 1024 * 1024;

  /** Sem SVG/HTML de propósito: arquivo servido pelo mesmo domínio pode rodar script. */
  export const ALLOWED_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'application/pdf',
  ] as const;

  const EXTENSIONS: Record<string, (typeof ALLOWED_TYPES)[number]> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    pdf: 'application/pdf',
  };

  /** Extensão (sem ponto) que combina com o tipo; usada para montar o nome do arquivo. */
  export function extensionOf(type: string): string | undefined {
    return Object.keys(EXTENSIONS).find((ext) => EXTENSIONS[ext] === type);
  }

  export function root(): string {
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return node('node:path').resolve(env?.NAS_DIR || './nas');
  }

  /** Caminho relativo, sem "..", sem barra no começo e só com letras, números, "." "_" e "-". */
  export const Url = z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine(
      (url) =>
        url
          .split('/')
          .every((part) => /^[\w][\w.-]*$/.test(part) && part !== '.' && part !== '..'),
      'Invalid storage path.',
    );

  export const File = z
    .instanceof(Blob)
    .refine((file) => file.size > 0, 'The file is empty.')
    .refine((file) => file.size <= MAX_BYTES, `The file is larger than ${MAX_BYTES / 1024 / 1024} MB.`)
    .refine(
      (file) => (ALLOWED_TYPES as readonly string[]).includes(file.type),
      'Only images (JPG, PNG, WebP, GIF, AVIF), videos (MP4, WebM, MOV) and PDF are allowed.',
    );

  const ascii = (bytes: Uint8Array, start: number, text: string) =>
    text.length + start <= bytes.length && [...text].every((char, i) => bytes[start + i] === char.charCodeAt(0));

  /** Tipo do arquivo pelos primeiros bytes (a assinatura), ignorando o que o cliente disse que era. */
  export function detectType(bytes: Uint8Array): (typeof ALLOWED_TYPES)[number] | undefined {
    if (bytes[0] === 0x89 && ascii(bytes, 1, 'PNG\r\n') && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a')) return 'image/gif';
    if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) return 'image/webp';
    if (ascii(bytes, 0, '%PDF-')) return 'application/pdf';
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'video/webm';
    if (ascii(bytes, 4, 'ftyp')) {
      if (ascii(bytes, 8, 'avif') || ascii(bytes, 8, 'avis')) return 'image/avif';
      if (ascii(bytes, 8, 'qt  ')) return 'video/quicktime';
      return 'video/mp4';
    }
    return undefined;
  }

  /** Quem pode ler cada pasta de uma mesa: capa ("<mesa>/imagens/…") o mestre e os jogadores; mapas ("<mesa>/mapas/…") só o mestre. */
  export type Reader = 'gm' | 'member';

  /** Mesa dona do arquivo e quem pode lê-lo, ou null se o caminho não segue o formato conhecido (ninguém lê). */
  export function reader(url: string): { mesaID: string; reader: Reader } | null {
    if (!Url.safeParse(url).success) return null;
    const [mesaID, folder, ...rest] = url.split('/');
    if (!mesaID || rest.length === 0) return null;
    if (folder === 'imagens') return { mesaID, reader: 'member' };
    if (folder === 'mapas') return { mesaID, reader: 'gm' };
    return null;
  }

  export const Saved = z.object({
    url: Url,
    path: z.string().meta({ description: 'Absolute path of the file on disk.' }),
    size: z.number().int(),
    type: z.string(),
  });
  export type Saved = z.infer<typeof Saved>;

  /** Caminho absoluto no disco; recusa o que sair da raiz. */
  export function resolve(url: string): string {
    const clean = Url.parse(url);
    const { resolve: join, sep } = node('node:path');
    const base = root();
    const full = join(base, clean);
    if (!full.startsWith(base + sep)) throw new Error('Invalid storage path.');
    return full;
  }

  export const save = fn(
    z.object({ url: Url, file: File, overwrite: z.boolean().default(false) }),
    async ({ url, file, overwrite }): Promise<Saved> => {
      const target = resolve(url);
      if (!overwrite && (await exists(url))) throw new Error(`Already exists: ${url}`);

      // O tipo e a extensão têm de bater com o que o arquivo realmente é, não só com o que o cliente informou.
      const bytes = new Uint8Array(await file.arrayBuffer());
      const detected = detectType(bytes);
      const byName = EXTENSIONS[url.split('.').pop()?.toLowerCase() ?? ''];
      if (!detected || detected !== file.type || detected !== byName) {
        throw new Error('O conteúdo do arquivo não bate com o tipo informado.');
      }

      const { mkdir, rename, rm, writeFile } = node('node:fs/promises');
      await mkdir(node('node:path').dirname(target), { recursive: true });
      // Grava num temporário e troca: quem lê nunca vê um arquivo pela metade.
      const temp = `${target}.${crypto.randomUUID()}.part`;
      try {
        await writeFile(temp, bytes);
        await rename(temp, target);
      } catch (error) {
        await rm(temp, { force: true });
        throw error;
      }
      return { url, path: target, size: file.size, type: file.type };
    },
    { title: 'Save file', description: 'Store an image, video or PDF (up to 30 MB) on the NAS disk.' },
  );

  /** Conteúdo e tipo do arquivo guardado, ou null se não existir. O tipo vem da extensão. */
  export async function read(url: string): Promise<{ data: Uint8Array; type: string } | null> {
    const type = EXTENSIONS[url.split('.').pop()?.toLowerCase() ?? ''];
    if (!type) return null;
    return node('node:fs/promises')
      .readFile(resolve(url))
      .then(
        (data) => ({ data: new Uint8Array(data), type }),
        () => null,
      );
  }

  export async function exists(url: string): Promise<boolean> {
    return node('node:fs/promises').stat(resolve(url)).then(
      (info) => info.isFile(),
      () => false,
    );
  }

  export async function remove(url: string): Promise<void> {
    await node('node:fs/promises').rm(resolve(url), { force: true });
  }
}
