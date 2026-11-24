import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lessonIds = (JSON.parse(readFileSync(join(process.cwd(), 'content/lessons/w01.json'), 'utf8')) as { id: string }[])
  .concat(...['w02', 'w03', 'w04'].map((w) => JSON.parse(readFileSync(join(process.cwd(), `content/lessons/${w}.json`), 'utf8')) as { id: string }[]))
  .map((l) => l.id);

async function onboardWithProgress(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaczynamy' }).click({ force: true });
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Przejdź do ekranu głównego' }).click();
  await expect(page.getByRole('heading', { name: 'Dzisiaj' })).toBeVisible();
  const now = new Date().toISOString();
  const backup = {
    format: 'levada-backup',
    version: 1,
    exportedAt: now,
    tables: {
      settings: [{ id: 'settings', onboardingDone: true, createdAt: now, gender: 'm', dailyMinutes: 15, showPronunciation: true, showIpa: false, playbackRate: 1, repeatCount: 1, voiceURI: null, allowBrFallback: false, theme: 'light', autoPlayAudio: false }],
      profile: [{ id: 'profile', name: 'Tomasz', city: 'Funchal' }],
      lessonProgress: lessonIds.map((id) => ({ lessonId: id, status: 'completed', step: 0, startedAt: now, completedAt: now, score: 0.9, completions: 1 })),
    },
  };
  await page.goto('/#/ustawienia');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('import-input').setInputFiles({ name: 'kopia.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
  await expect(page.getByText(/Zaimportowano: 24 lekcji/)).toBeVisible();
}

test('scenariusz z wariantami odpowiedzi i pytania bez scenariusza', async ({ page }) => {
  await onboardWithProgress(page);
  await page.goto('/#/rozmowy');
  await page.getByText('Kawa u Ruiego').click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Pokaż przykładowe odpowiedzi' }).click();
    await page.getByRole('button', { name: i === 1 ? 'Prawie' : 'Umiem', exact: true }).click();
  }
  await expect(page.getByTestId('scenario-done')).toBeVisible();

  // zadanie osobiste używa imienia z życiorysu
  await page.goto('/#/rozmowy/scenariusz/sc-vizinha');
  await page.getByRole('button', { name: 'Pokaż przykładowe odpowiedzi' }).click();
  await page.getByRole('button', { name: 'Umiem', exact: true }).click();
  await expect(page.getByText('Chamo-me Tomasz.')).toBeVisible();

  await page.goto('/#/rozmowy/pytania?n=2');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Pokaż przykładowe odpowiedzi' }).click();
    await page.getByRole('button', { name: 'Nie umiem', exact: true }).click();
  }
  await expect(page.getByTestId('questions-done')).toBeVisible();
  // „nie umiem” trafia do zeszytu błędów
  await page.goto('/#/bledy');
  await expect(page.getByText('Samodzielne budowanie zdania')).toBeVisible();
});

test('trener AI przez serwer pośredniczący (tryb testowy): zgoda, rozmowa, podsumowanie', async ({ page }) => {
  await onboardWithProgress(page);
  await page.goto('/#/rozmowy/ai');
  await expect(page.getByText('Opcjonalna funkcja — wymaga konfiguracji')).toBeVisible();
  await page.goto('/#/ustawienia');
  await page.getByPlaceholder('np. http://localhost:8787/').fill('http://localhost:8787');
  await page.getByRole('button', { name: 'Zapisz i sprawdź połączenie' }).click();
  await expect(page.getByText(/TRYBIE TESTOWYM/)).toBeVisible();
  await page.goto('/#/rozmowy/ai');
  await expect(page.getByText('Zanim zaczniesz')).toBeVisible();
  await page.getByRole('button', { name: 'Rozumiem i zgadzam się' }).click();
  await page.getByRole('button', { name: 'Zacznij rozmowę' }).click();
  await page.waitForTimeout(2000);
  await expect(page.getByText('Olá! Como se chama?')).toBeVisible();
  await page.getByLabel('Twoja odpowiedź').fill('Me chamo Tomasz.');
  await page.getByRole('button', { name: 'Wyślij' }).click();
  await expect(page.getByText('Muito prazer! De onde é?')).toBeVisible();
  await page.getByRole('button', { name: 'Zakończ i pokaż podsumowanie' }).click();
  await expect(page.getByTestId('ai-summary')).toContainText('Chamo-me');
  await page.goto('/#/bledy');
  await expect(page.getByText(/\[AI, niezweryfikowane\]/)).toBeVisible();
});
