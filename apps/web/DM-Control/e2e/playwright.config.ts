import { defineConfig } from '@playwright/test';

// Roda contra um servidor que já está de pé (`bun run dev --port 5199`) e a API local (`docker compose up -d api`).
export default defineConfig({
	testDir: '.',
	testMatch: '**/*.e2e.ts',
	workers: 1,
	use: { baseURL: process.env.E2E_URL ?? 'http://127.0.0.1:5199', viewport: { width: 1400, height: 850 } }
});
