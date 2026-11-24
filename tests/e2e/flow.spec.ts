import { expect, test, type Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaczynamy' }).click({ force: true });
  await page.getByLabel(/Twoje imię/).fill('Tomasz');
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
}

/** Odpowiada na bieżące ćwiczenie (niekoniecznie poprawnie) i przechodzi dalej. */
async function answerExercise(page: Page) {
  const ex = page.getByTestId('exercise');
  const type = await ex.getAttribute('data-type');
  if (type === 'minimalPair') {
    const skip = ex.getByRole('button', { name: 'Pomiń' });
    if (await skip.isVisible()) await skip.click();
    else await ex.locator('button.rounded-xl').first().click();
  } else if (type === 'listenChoose' || type === 'readChoose' || type === 'recallChoose') {
    await ex.locator('div.grid > button').first().click();
  } else if (type === 'fillGap') {
    await ex.locator('div.flex-wrap > button').first().click();
  } else if (type === 'buildSentence' || type === 'transform') {
    const tiles = page.getByTestId('build-tiles').locator('button');
    await tiles.first().click();
    await ex.getByRole('button', { name: 'Sprawdź' }).click();
  } else if (type === 'typeAnswer') {
    await ex.getByLabel('Odpowiedź po portugalsku').fill('olá');
    await ex.getByRole('button', { name: 'Sprawdź' }).click();
  } else if (type === 'recallSay') {
    await ex.getByRole('button', { name: 'Pokaż wzór' }).click();
    await ex.getByRole('button', { name: 'Umiem', exact: true }).click();
  }
  await ex.locator('[role=status] button').last().click();
}

test('pełna ścieżka: onboarding → lekcja 1 → powtórki → mapa → eksport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await onboard(page);
  await page.getByRole('button', { name: 'Rozpocznij pierwszą lekcję' }).click();
  await expect(page.getByTestId('lesson-player')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Jak brzmi portugalski europejski?' })).toBeVisible();

  // kroki 1–5: rozgrzewka, nowe słowa (7), zasada, przykłady, dialog
  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('exercise').isVisible()) break;
    await page.getByTestId('lesson-next').click();
  }
  // wymowa PL jest widoczna przy słowach (krok „Nowe słowa” mijamy, ale sprawdzamy w ćwiczeniach i podsumowaniu)
  for (let i = 0; i < 20; i++) {
    if (!(await page.getByTestId('exercise').isVisible())) break;
    await answerExercise(page);
  }
  // mówienie
  for (let i = 0; i < 10; i++) {
    const t = page.getByTestId('speaking-task');
    if (!(await t.isVisible())) break;
    await t.getByRole('button', { name: 'Pokaż przykładową odpowiedź' }).click();
    await t.getByRole('button', { name: 'Umiem', exact: true }).click();
    await page.waitForTimeout(500);
  }
  await expect(page.getByTestId('lesson-summary')).toBeVisible();
  await expect(page.getByText(/Do powtórek trafiło \d+ elementów/)).toBeVisible();
  await expect(page.getByLabel(/wymowa: SĨ/).first()).toBeVisible();
  await page.getByTestId('lesson-finish').click();

  // Dzisiaj: lekcja odhaczona, są powtórki
  await expect(page.getByRole('heading', { name: 'Dzisiaj' })).toBeVisible();
  await page.goto('/#/powtorki?n=4');
  await expect(page.getByTestId('review')).toBeVisible();
  for (let i = 0; i < 4; i++) await answerExercise(page);
  await expect(page.getByTestId('review-summary')).toBeVisible();

  // szlak i mapa
  await page.goto('/#/szlak');
  await expect(page.getByRole('group', { name: /Mapa szlaku/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Funchal: aktualny etap/ })).toBeVisible();

  // eksport
  await page.goto('/#/ustawienia');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export').click()]);
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import('node:fs');
  const json = JSON.parse(fs.readFileSync(path!, 'utf8'));
  expect(json.format).toBe('levada-backup');
  expect(json.tables.lessonProgress.length).toBeGreaterThan(0);
  expect(json.tables.cards.length).toBeGreaterThan(10);

  // import tego samego pliku
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('import-input').setInputFiles(path!);
  await expect(page.getByText(/Zaimportowano: 1 lekcji/)).toBeVisible();

  expect(errors).toEqual([]);
});

test('brak głosu pt-PT → zrozumiały komunikat zamiast cichego pt-BR', async ({ page }) => {
  await onboard(page);
  await expect(page.getByText(/Brak europejskiego głosu portugalskiego|Znaleziono głos/)).toBeVisible();
  await page.getByRole('button', { name: 'Przejdź do ekranu głównego' }).click();
  await expect(page.getByRole('heading', { name: 'Dzisiaj' })).toBeVisible();
  await page.goto('/#/ustawienia');
  await expect(page.getByRole('heading', { name: 'Audio' })).toBeVisible();
});

test('onboarding bez imienia prowadzi prosto do lekcji 1', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaczynamy' }).click({ force: true });
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Rozpocznij pierwszą lekcję' }).click();
  await expect(page.getByTestId('lesson-player')).toBeVisible();
});

test('zmiana czasu na dziś i tryb 5 minut', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Przejdź do ekranu głównego' }).click();
  await expect(page.getByRole('heading', { name: 'Dzisiaj' })).toBeVisible();
  await page.getByRole('radio', { name: '5 min', exact: true }).click();
  await expect(page.getByText('Plan na ok. 5 min')).toBeVisible();
  await expect(page.getByText('Jedno ćwiczenie wymowy').first()).toBeVisible();
});

test('laboratorium dźwięków i strony bez poziomego przewijania (360 px)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Przejdź do ekranu głównego' }).click();
  await expect(page.getByRole('heading', { name: 'Dzisiaj' })).toBeVisible();
  for (const route of ['/', '/#/szlak', '/#/dzwieki', '/#/dzwieki/open-closed-o', '/#/wiecej', '/#/postepy', '/#/bledy', '/#/sluchanie', '/#/rozmowy', '/#/lekcja/w02-l09', '/#/kompetencje', '/#/sciagawki', '/#/sciagawki/seguranca-social', '/#/sluchaj', '/#/czytanki', '/#/zyciorys', '/#/moje-zdania', '/#/minuta-odwagi', '/#/misje', '/#/sprawdzian/w04-test']) {
    await page.goto(route);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `poziome przewijanie na ${route}`).toBeLessThanOrEqual(0);
  }
  await page.goto('/#/dzwieki/open-closed-o');
  await expect(page.getByText('Pary minimalne')).toBeVisible();
  await expect(page.getByRole('img', { name: /Schemat samogłosek/ })).toBeVisible();
});

test('sprawdzian tygodnia: wynik i rekomendacje bez blokowania nauki', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Przejdź do ekranu głównego' }).click();
  await expect(page.getByRole('heading', { name: 'Dzisiaj' })).toBeVisible();
  await page.goto('/#/sprawdzian/w01-test');
  await page.getByTestId('test-start').click();
  for (let i = 0; i < 30; i++) {
    if (await page.getByTestId('exercise').isVisible()) await answerExercise(page);
    else if (await page.getByTestId('speaking-task').isVisible()) {
      const t = page.getByTestId('speaking-task');
      await t.getByRole('button', { name: 'Pokaż przykładową odpowiedź' }).click();
      await t.getByRole('button', { name: 'Prawie', exact: true }).click();
      await page.waitForTimeout(500);
    } else break;
  }
  await expect(page.getByTestId('test-result')).toBeVisible();
  await expect(page.getByText(/Mówienie \(samoocena\)/)).toBeVisible();
});
