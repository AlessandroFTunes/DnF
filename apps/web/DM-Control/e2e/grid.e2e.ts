import { expect, test } from '@playwright/test';
import { deflateSync } from 'node:zlib';
import PocketBase from 'pocketbase';

const PB_URL = process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';
const PASSWORD = 'e2e-password-123';
const email = `e2e-grid-${Date.now()}@dnf.local`;

/** PNG liso 1200x800 com um quadriculado, só para ter o que desenhar por cima. */
function mapaPng(): Buffer {
	const [w, h] = [1200, 800];
	const crc = (buf: Buffer) => {
		let c,
			crc = 0xffffffff;
		for (const byte of buf) {
			c = (crc ^ byte) & 0xff;
			for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			crc = (crc >>> 8) ^ c;
		}
		return (crc ^ 0xffffffff) >>> 0;
	};
	const chunk = (type: string, data: Buffer) => {
		const body = Buffer.concat([Buffer.from(type), data]);
		const out = Buffer.alloc(12 + data.length);
		out.writeUInt32BE(data.length, 0);
		body.copy(out, 4);
		out.writeUInt32BE(crc(body), 8 + data.length);
		return out;
	};
	const raw = Buffer.alloc((w * 3 + 1) * h);
	for (let y = 0; y < h; y++) {
		raw[y * (w * 3 + 1)] = 0;
		for (let x = 0; x < w; x++) {
			const shade = (Math.floor(x / 70) + Math.floor(y / 70)) % 2 ? 90 : 120;
			const i = y * (w * 3 + 1) + 1 + x * 3;
			raw[i] = shade;
			raw[i + 1] = shade + 20;
			raw[i + 2] = shade;
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(w, 0);
	ihdr.writeUInt32BE(h, 4);
	ihdr[8] = 8;
	ihdr[9] = 2;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

const erros: string[] = [];
let pb: PocketBase;
let mesaId: string;
let userId: string;

test.beforeAll(async () => {
	pb = new PocketBase(PB_URL);
	const user = await pb.collection('users').create({
		email,
		password: PASSWORD,
		passwordConfirm: PASSWORD,
		name: 'E2E Grid'
	});
	userId = user.id;
	await pb.collection('users').authWithPassword(email, PASSWORD);
	const mesa = await pb.collection('mesas').create({ name: 'Mesa E2E', edition: '2024', gm: userId });
	mesaId = mesa.id;
});

test.afterEach(({}, info) => {
	if (info.status !== 'passed') console.log('ERROS DO NAVEGADOR:\n' + erros.join('\n'));
});

test.afterAll(async () => {
	// Apaga a mesa (e as grids/cenas em cascata) e o usuário de teste.
	await pb.collection('mesas').delete(mesaId).catch(() => {});
	await pb.collection('users').delete(userId).catch(() => {});
});

test.setTimeout(90000);

test('cria grid, edita a cena, salva e mostra a visão do jogador', async ({ browser, baseURL }) => {
	const context = await browser.newContext();
	const cookie = pb.authStore.exportToCookie({ httpOnly: false, secure: false }, 'pb_auth');
	const value = cookie.slice('pb_auth='.length, cookie.indexOf(';'));
	await context.addCookies([{ name: 'pb_auth', value, url: baseURL! }]);
	const page = await context.newPage();
	page.on('pageerror', (e) => erros.push(e.message));
	page.on('console', (m) => m.type() === 'error' && erros.push(m.text()));

	// Sem grids: botão para criar a primeira.
	await page.goto(`/mesa/${mesaId}/mapas`);
	const primeiro = page.getByRole('button', { name: 'Crie seu primeiro grid' });
	await expect(primeiro, erros.join('\n')).toBeVisible({ timeout: 20000 });
	await primeiro.click();

	await page.locator('input[type=file]').setInputFiles({ name: 'mapa.png', mimeType: 'image/png', buffer: mapaPng() });
	await page.getByLabel('Nome').fill('Taverna');
	await page.getByRole('button', { name: 'Criar' }).click();
	await expect(page.getByText('Taverna')).toBeVisible();

	// Editor
	await page.getByRole('link', { name: 'Abrir', exact: true }).click();
	const canvas = page.locator('canvas');
	await expect(canvas).toBeVisible({ timeout: 15000 });
	await page.waitForTimeout(500);
	const box = (await canvas.boundingBox())!;
	const at = (fx: number, fy: number) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

	// Token
	await page.getByRole('button', { name: 'Adicionar token' }).click();
	const t = at(0.5, 0.5);
	await page.mouse.click(t.x, t.y);
	await expect(page.getByRole('heading', { name: 'Token' })).toBeVisible();
	await page.getByLabel('Personagem de jogador').check();
	await page.getByLabel('Visão no escuro (pés)').fill('60');
	await page.getByLabel('Visão no escuro (pés)').blur();

	// Mover o token (selecionar e arrastar)
	await page.getByRole('button', { name: /Selecionar e mover/ }).click();
	await page.mouse.move(t.x, t.y);
	await page.mouse.down();
	await page.mouse.move(t.x + 140, t.y + 70, { steps: 8 });
	await page.mouse.up();

	// Parede, porta, luz, desenho
	for (const [nome, a, b] of [
		['Parede', at(0.6, 0.2), at(0.6, 0.8)],
		['Porta', at(0.4, 0.2), at(0.4, 0.4)],
		['Retângulo', at(0.2, 0.2), at(0.3, 0.35)]
	] as const) {
		await page.getByRole('button', { name: new RegExp(nome) }).click();
		await page.mouse.move(a.x, a.y);
		await page.mouse.down();
		await page.mouse.move(b.x, b.y, { steps: 6 });
		await page.mouse.up();
	}
	await page.getByRole('button', { name: 'Luz', exact: true }).click();
	const l = at(0.7, 0.5);
	await page.mouse.click(l.x, l.y);
	await expect(page.getByRole('heading', { name: 'Luz' })).toBeVisible();
	await page.getByRole('button', { name: 'Caneta' }).click();
	await page.mouse.move(at(0.1, 0.8).x, at(0.1, 0.8).y);
	await page.mouse.down();
	await page.mouse.move(at(0.2, 0.9).x, at(0.2, 0.85).y, { steps: 10 });
	await page.mouse.up();

	// Fog + iluminação
	await page.getByLabel('Ativar fog').check();
	await page.getByLabel('Ativar (paredes, luzes e visão)').check();
	await page.getByRole('button', { name: /Revelar área/ }).click();
	const r1 = at(0.05, 0.05);
	await page.mouse.move(r1.x, r1.y);
	await page.mouse.down();
	await page.mouse.move(at(0.15, 0.15).x, at(0.15, 0.15).y, { steps: 4 });
	await page.mouse.up();

	await expect(page.getByRole('status')).toHaveText('Salvo', { timeout: 10000 });
	await page.screenshot({ path: 'test-results/editor.png' });

	// Persistiu no JSON?
	const cena = await pb.collection('grid_scenes').getFirstListItem('grid.mesa = "' + mesaId + '"');
	const data = cena.data;
	expect(data.tokens).toHaveLength(1);
	expect(data.tokens[0]).toMatchObject({ player: true, vision: 60 });
	expect(data.tokens[0].x).toBeGreaterThan(0);
	expect(data.walls.map((w: { kind: string }) => w.kind).sort()).toEqual(['door', 'wall']);
	expect(data.lights).toHaveLength(1);
	expect(data.drawings.map((d: { tool: string }) => d.tool).sort()).toEqual(['pen', 'rect']);
	expect(data.fog).toMatchObject({ enabled: true });
	expect(data.fog.revealed).toHaveLength(1);
	expect(data.lighting.enabled).toBe(true);

	// Recarregar mantém tudo
	await page.reload();
	await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });
	await expect(page.getByLabel('Ativar fog')).toBeChecked();

	// Visão do jogador (outra janela): carrega e recebe alterações do mestre
	const jogador = await context.newPage();
	jogador.on('pageerror', (e) => erros.push('jogador: ' + e.message));
	await jogador.goto(page.url() + '/jogador');
	await expect(jogador.locator('canvas')).toBeVisible({ timeout: 15000 });
	await jogador.waitForTimeout(800);
	await jogador.screenshot({ path: 'test-results/jogador.png' });

	expect(erros.filter((e) => !/favicon|Failed to load resource/.test(e))).toEqual([]);
});
