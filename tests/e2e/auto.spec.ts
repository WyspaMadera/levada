import { expect, test } from '@playwright/test';

/** Podstawiony silnik TTS z głosem pt-PT i pl-PL, który „mówi” natychmiast — do testów odtwarzacza. */
const FAKE_TTS = () => {
  const voices = [
    { name: 'Test PT', lang: 'pt-PT', voiceURI: 'test-pt', localService: true, default: false },
    { name: 'Test PL', lang: 'pl-PL', voiceURI: 'test-pl', localService: true, default: true },
  ];
  const spoken: string[] = [];
  (window as unknown as { __spoken: string[] }).__spoken = spoken;
  class Utt {
    text: string;
    voice: unknown = null;
    lang = '';
    rate = 1;
    onend: (() => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null;
    constructor(t: string) {
      this.text = t;
    }
  }
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utt, configurable: true });
  Object.defineProperty(window, 'speechSynthesis', {
    configurable: true,
    value: {
      getVoices: () => voices,
      speak: (u: Utt) => {
        spoken.push(`${u.lang}:${u.text}`);
        setTimeout(() => u.onend?.(), 40);
      },
      cancel: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
};

test('Tryb Auto: odtwarza PL → PT, pauzuje, wznawia od zapamiętanego miejsca, przygotowuje playlistę na jutro', async ({ page }) => {
  await page.addInitScript(FAKE_TTS);
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaczynamy' }).click({ force: true });
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
  await expect(page.getByText('Znaleziono głos')).toBeVisible();
  await page.getByRole('button', { name: 'Przejdź do ekranu głównego' }).click();
  await expect(page.getByRole('heading', { name: 'Dzisiaj' })).toBeVisible();
  // materiał: ukończona lekcja 2 (import kopii)
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
          lessonProgress: ['w01-l01', 'w01-l02'].map((id) => ({ lessonId: id, status: 'completed', step: 0, startedAt: now, completedAt: now, score: 1, completions: 1 })),
        },
      }),
    ),
  });
  await expect(page.getByText(/Zaimportowano: 2 lekcji/)).toBeVisible();

  await page.goto('/#/sluchanie');
  await page.getByRole('radio', { name: /Lekcja na słuch/ }).click();
  await expect(page.getByTestId('auto-queue')).toContainText('olá');
  await page.getByRole('button', { name: 'Odtwarzaj' }).click();
  await expect(page.getByTestId('auto-label')).toContainText(/PL: |PT: /);
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  await expect.poll(async () => (await spoken()).some((s) => s.startsWith('pl-PL:')), { timeout: 5000 }).toBe(true); // polskie znaczenie
  // po pauzie na odpowiedź (3,5 s) — portugalski
  await expect.poll(async () => (await spoken()).some((s) => s.startsWith('pt-PT:')), { timeout: 10000 }).toBe(true);
  await page.getByRole('button', { name: 'Pauza' }).click();
  await page.getByRole('button', { name: 'Następny element' }).click();
  await expect(page.getByText(/Element 2 z/)).toBeVisible();
  // po odświeżeniu: ta sama sesja wznawia się w tym samym miejscu
  await page.reload();
  await page.getByRole('radio', { name: /Lekcja na słuch/ }).click();
  await expect(page.getByRole('button', { name: 'Wznów' })).toBeVisible();
  await expect(page.getByText(/Element 2 z/)).toBeVisible();

  await page.getByRole('button', { name: 'Przygotuj playlistę na jutro' }).click();
  await expect(page.getByText(/Zapisano playlistę na jutro: 11 elementów/)).toBeVisible();
});

test('przycisk odsłuchu w lekcji używa głosu pt-PT (nie pt-BR)', async ({ page }) => {
  await page.addInitScript(FAKE_TTS);
  await page.goto('/');
  await page.getByRole('button', { name: 'Zaczynamy' }).click({ force: true });
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Dalej' }).click();
  await page.getByRole('button', { name: 'Rozpocznij pierwszą lekcję' }).click();
  await page.getByTestId('lesson-next').click();
  await page.getByRole('button', { name: 'Odsłuchaj: sim' }).click();
  await page.waitForTimeout(300);
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(spoken).toContain('pt-PT:sim');
});
