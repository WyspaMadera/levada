import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173', trace: 'off' },
  webServer: [
    { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
    // serwer pośredniczący AI w trybie testowym (bez wywołań API)
    {
      command: 'npx tsx server/ai-proxy.ts',
      url: 'http://localhost:8787/v1/health',
      reuseExistingServer: true,
      env: { AI_MOCK: '1', PORT: '8787', ALLOWED_ORIGINS: 'http://localhost:4173' },
    },
  ],
  projects: [
    { name: 'mobile-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true } },
  ],
});
