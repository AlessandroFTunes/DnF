import { describe, expect, test } from 'bun:test';
import { Nas } from '../src/storage/nas';

const bytes = (...values: number[]) => new Uint8Array([...values, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const text = (value: string) => Uint8Array.from([...value].map((char) => char.charCodeAt(0)));

describe('Nas.detectType', () => {
  test('reconhece as assinaturas permitidas', () => {
    expect(Nas.detectType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(Nas.detectType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(Nas.detectType(text('GIF89a....'))).toBe('image/gif');
    expect(Nas.detectType(text('RIFF....WEBPVP8 '))).toBe('image/webp');
    expect(Nas.detectType(text('%PDF-1.7'))).toBe('application/pdf');
    expect(Nas.detectType(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe('video/webm');
    expect(Nas.detectType(text('....ftypavif'))).toBe('image/avif');
    expect(Nas.detectType(text('....ftypqt  '))).toBe('video/quicktime');
    expect(Nas.detectType(text('....ftypisom'))).toBe('video/mp4');
  });

  test('recusa o que não tem assinatura conhecida (SVG, HTML, texto)', () => {
    expect(Nas.detectType(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeUndefined();
    expect(Nas.detectType(text('<html><script>alert(1)</script></html>'))).toBeUndefined();
    expect(Nas.detectType(new Uint8Array())).toBeUndefined();
  });
});

describe('Nas.save', () => {
  const url = `teste/imagens/${crypto.randomUUID()}.png`;

  test('recusa um arquivo que diz ser PNG mas não é', async () => {
    const falso = new Blob([text('<html><script>alert(1)</script></html>')], { type: 'image/png' });
    await expect(Nas.save({ url, file: falso })).rejects.toThrow();
    expect(await Nas.exists(url)).toBe(false);
  });

  test('recusa PNG enviado com extensão ou tipo de outro formato', async () => {
    const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    await expect(Nas.save({ url: url.replace('.png', '.jpg'), file: new Blob([png], { type: 'image/png' }) })).rejects.toThrow();
    await expect(Nas.save({ url, file: new Blob([png], { type: 'image/jpeg' }) })).rejects.toThrow();
  });
});

describe('Nas.reader', () => {
  test('capa: mestre e jogadores da mesa', () => {
    expect(Nas.reader('abc123/imagens/capa.png')).toEqual({ mesaID: 'abc123', reader: 'member' });
  });

  test('mapa: só o mestre', () => {
    expect(Nas.reader('abc123/mapas/1700000000000.webp')).toEqual({ mesaID: 'abc123', reader: 'gm' });
  });

  test('caminhos fora do formato ou perigosos não são lidos por ninguém', () => {
    for (const url of ['abc123/outros/x.png', 'abc123/mapas', 'capa.png', '../abc123/mapas/x.png', 'abc123/mapas/../x.png', '/abc123/mapas/x.png', '']) {
      expect(Nas.reader(url)).toBeNull();
    }
  });
});
