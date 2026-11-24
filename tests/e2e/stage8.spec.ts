import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lessons = ['w01', 'w02', 'w03', 'w04'].flatMap((w) => (JSON.parse(readFileSync(join(process.cwd(), `content/lessons/${w}.json`), 'utf8')) as { id: string }[]).map((l) => l.id));

test('sprawdzian miesiąca: ćwiczenia, symulacja, monolog → wynik → mapa kompetencji i analiza', async ({ page }) => {
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
          lessonProgress: lessons.map((id) => ({ lessonId: id, status: 'completed', step: 0, startedAt: now, completedAt: now, score: 0.9, completions: 1 })),
        },
      }),
    ),
  });
  await expect(page.getByText(/Zaimportowano/)).toBeVisible();

  await page.goto('/#/sprawdzian/w04-test');
  await page.getByTestId('test-start').click();
  for (let i = 0; i < 60; i++) {
    const ex = page.getByTestId('exercise');
    if (await ex.isVisible()) {
      const type = await ex.getAttribute('data-type');
      if (type === 'minimalPair') await ex.getByRole('button', { name: 'Pomiń' }).click();
      else if (type === 'fillGap') await ex.locator('div.flex-wrap > button').first().click();
      else if (type === 'buildSentence' || type === 'transform') {
        await page.getByTestId('build-tiles').locator('button').first().click();
        await ex.getByRole('button', { name: 'Sprawdź' }).click();
      } else if (type === 'typeAnswer') {
        await ex.getByLabel('Odpowiedź po portugalsku').fill('x');
        await ex.getByRole('button', { name: 'Sprawdź' }).click();
      } else if (type === 'recallSay') {
        await ex.getByRole('button', { name: 'Pokaż wzór' }).click();
        await ex.getByRole('button', { name: 'Umiem', exact: true }).click();
      } else await ex.locator('div.grid > button').first().click();
      await ex.locator('[role=status] button').last().click();
    } else if (await page.getByTestId('test-scenario').isVisible()) {
      await page.getByRole('button', { name: 'Pokaż przykładowe odpowiedzi' }).click();
      await page.getByRole('button', { name: 'Umiem', exact: true }).click();
    } else if (await page.getByTestId('speaking-task').isVisible()) {
      const t = page.getByTestId('speaking-task');
      await t.getByRole('button', { name: 'Pokaż przykładową odpowiedź' }).click();
      await t.getByRole('button', { name: 'Prawie', exact: true }).click();
      await page.waitForTimeout(400);
    } else if (await page.getByTestId('monologue').isVisible()) {
      await page.getByRole('button', { name: 'Zaczynam mówić' }).click();
      await page.waitForTimeout(1200);
      await page.getByRole('button', { name: 'Koniec' }).click();
      const boxes = page.getByTestId('monologue').getByRole('checkbox');
      for (let k = 0; k < 3; k++) await boxes.nth(k).check();
      await page.getByRole('button', { name: 'Zapisz i dalej' }).click();
      await expect(page.getByTestId('monologue')).toBeHidden();
    } else break;
  }
  await expect(page.getByTestId('test-result')).toBeVisible();
  await expect(page.getByText(/Monolog: 3 z 8 punktów planu/)).toBeVisible();
  await expect(page.getByText(/Symulacja „Umawiamy się na plażę”: umiem 3 z 3/)).toBeVisible();
  await page.getByRole('button', { name: 'Zobacz mapę kompetencji' }).click();
  await expect(page.getByRole('heading', { name: 'Mapa kompetencji' })).toBeVisible();
  await expect(page.getByTestId('competence-powitania')).toContainText(/poznane|w trakcie|umiesz/);
  await page.goto('/#/postepy');
  await expect(page.getByTestId('analysis')).toContainText('Najtrudniejsze zwroty');
});
