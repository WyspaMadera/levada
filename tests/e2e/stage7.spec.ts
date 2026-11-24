import { expect, test, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const lessons = ['w01', 'w02', 'w03', 'w04'].flatMap((w) => (JSON.parse(readFileSync(join(process.cwd(), `content/lessons/${w}.json`), 'utf8')) as { id: string }[]).map((l) => l.id));

async function setup(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaczynamy' }).click({ force: true });
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Przejdź do ekranu głównego' }).click();
  await expect(page.getByRole('heading', { name: 'Dzisiaj' })).toBeVisible();
  const now = new Date().toISOString();
  await page.goto('/#/ustawienia');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('import-input').setInputFiles({
    name: 'k.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        format: 'levada-backup',
        version: 1,
        exportedAt: now,
        tables: {
          settings: [{ id: 'settings', onboardingDone: true, createdAt: now, gender: 'm', dailyMinutes: 15, showPronunciation: true, showIpa: false, playbackRate: 1, repeatCount: 1, voiceURI: null, allowBrFallback: false, theme: 'light', autoPlayAudio: false }],
          profile: [{ id: 'profile', name: 'Tomasz', city: 'Funchal' }],
          lessonProgress: lessons.map((id) => ({ lessonId: id, status: 'completed', step: 0, startedAt: now, completedAt: now, score: 0.9, completions: 1 })),
        },
      }),
    ),
  });
  await expect(page.getByText(/Zaimportowano/)).toBeVisible();
}

test('ściągawka → powiększenie → Moje zdania → ćwiczenie na głos', async ({ page }) => {
  await setup(page);
  await page.goto('/#/sciagawki');
  await page.locator('a[href="#/sciagawki/przedszkole"]').click();
  await page.getByRole('button', { name: 'Powiększ, aby pokazać rozmówcy' }).first().click();
  await expect(page.getByText('Możesz pokazać ten ekran rozmówcy.')).toBeVisible();
  await page.getByRole('button', { name: 'Zamknij powiększenie' }).click();
  await page.getByRole('button', { name: 'Zapisz w Moich zdaniach' }).first().click();
  await expect(page.getByRole('button', { name: 'Usuń z Moich zdań' }).first()).toBeVisible();
  await page.goto('/#/moje-zdania');
  await page.getByLabel('Zdanie po portugalsku').fill('Me chamo Tomasz');
  await expect(page.getByText(/Wygląda na formę brazylijską/)).toBeVisible();
  await page.getByLabel('Zdanie po portugalsku').fill('O meu vizinho é simpático.');
  await page.getByRole('button', { name: 'Dodaj' }).click();
  await expect(page.getByText('Twój tekst — bez zapisu wymowy')).toBeVisible();
  await page.getByRole('button', { name: /Ćwicz na głos/ }).click();
  await expect(page.getByTestId('review')).toBeVisible();
  await page.getByRole('button', { name: 'Pokaż wzór' }).click();
  await page.getByRole('button', { name: 'Umiem', exact: true }).click();
  await page.locator('[data-testid=exercise] [role=status] button').last().click();
  await expect(page.getByTestId('review-summary')).toBeVisible();
});

test('Minuta odwagi i misja', async ({ page }) => {
  await setup(page);
  await page.goto('/#/minuta-odwagi');
  await page.getByRole('button', { name: /Start — 60 s/ }).click();
  await expect(page.getByText(/^(60|59|58)$/)).toBeVisible();
  await page.getByRole('button', { name: 'Skończyłem/am wcześniej' }).click();
  await page.getByRole('button', { name: 'Z przerwami' }).click();
  await expect(page.getByText('Brawo za odwagę!', { exact: false })).toBeVisible();
  await page.goto('/#/misje');
  const first = page.getByRole('button', { name: 'Zrobione — zapisz' }).first();
  if (await first.isVisible()) {
    await first.click();
    await page.getByRole('button', { name: 'Udało się' }).click();
    await expect(page.getByText('1×').first()).toBeVisible();
  }
});

test('czytanka: dotknij słowa, pytanie sprawdzające', async ({ page }) => {
  test.skip(!existsSync(join(process.cwd(), 'content/readings/readings.json')), 'brak czytanek');
  await setup(page);
  await page.goto('/#/czytanki');
  await page.locator('a[href^="#/czytanki/"]').first().click();
  await expect(page.getByTestId('reading')).toBeVisible();
  await page.getByTestId('reading').locator('p[lang="pt-PT"] button').first().click();
  await expect(page.getByRole('dialog', { name: /Słowo:/ })).toBeVisible();
  await page.getByRole('button', { name: 'Zamknij' }).click();
  await page.getByRole('region', { name: 'Pytania' }).getByRole('button').first().click();
});

test('biblioteka i życiorys', async ({ page }) => {
  await setup(page);
  await page.goto('/#/sluchaj');
  await expect(page.getByRole('heading', { name: 'Słuchaj portugalskiego' })).toBeVisible();
  await page.goto('/#/zyciorys');
  await expect(page.getByRole('heading', { name: 'Mój portugalski życiorys' })).toBeVisible();
});
