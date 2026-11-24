/** Klient opcjonalnego trenera AI. Rozmawia WYŁĄCZNIE z serwerem pośredniczącym użytkownika (klucz API jest tam). */
import { content } from '@/content/content';
import { db, type Settings } from '@/db/db';
import {
  LEVEL_LIMITS,
  summaryOutputSchema,
  turnOutputSchema,
  type TutorRequest,
  type TutorSummary,
  type TutorTurn,
} from '../../server/tutor-protocol';

export { LEVEL_LIMITS };
export type { TutorSummary, TutorTurn };

export type TutorHistory = TutorRequest['history'];

export class TutorError extends Error {}

const ERR_PL: Record<string, string> = {
  'bad-token': 'Serwer odrzucił token dostępu. Sprawdź token w Ustawieniach.',
  'origin-not-allowed': 'Serwer nie zezwala na połączenia z tego adresu aplikacji (ALLOWED_ORIGINS).',
  'rate-limited': 'Za dużo zapytań w krótkim czasie. Spróbuj za kilka minut.',
  'upstream-rate-limited': 'Usługa AI jest chwilowo przeciążona. Spróbuj za chwilę.',
  'proxy-auth-misconfigured': 'Serwer pośredniczący nie ma poprawnego klucza API.',
  refusal: 'AI odmówiło odpowiedzi na tę wiadomość. Spróbuj sformułować ją inaczej.',
  'conversation-too-long': 'Rozmowa osiągnęła limit długości dla Twojego poziomu. Zakończ ją, aby zobaczyć podsumowanie.',
};

/** Poziom do rozmowy AI — wg postępu (bez zawyżania). */
export function levelFor(completedLessons: number): 'A0' | 'A1' | 'A2' | 'B1' {
  if (completedLessons < 12) return 'A0';
  if (completedLessons < 48) return 'A1';
  return completedLessons < 96 ? 'A2' : 'B1';
}

/** Kontekst ucznia: umiejętności z ukończonych lekcji i znane słowa (z kart powtórek). */
export async function buildContext(settings: Settings, topic: string): Promise<Omit<TutorRequest, 'history'>> {
  const done = await db.lessonProgress.where('status').equals('completed').toArray();
  const ids = new Set(done.map((d) => d.lessonId));
  const canDo = content.lessons.filter((l) => ids.has(l.id)).flatMap((l) => l.canDo);
  const cards = await db.cards.toArray();
  const words = new Set<string>();
  for (const c of cards) {
    const it = content.items.get(c.itemId);
    if (!it) continue;
    for (const w of it.pt.toLowerCase().match(/[\p{L}]+(?:-[\p{L}]+)*/gu) ?? []) words.add(w);
  }
  let profile: TutorRequest['profile'];
  if (settings.aiShareProfile) {
    const p = await db.profile.get('profile');
    if (p) profile = { name: p.name || undefined, city: p.city || undefined, job: p.job || undefined, interests: p.interests || undefined };
  }
  return { level: levelFor(ids.size), topic, gender: settings.gender, canDo: canDo.slice(-150), knownWords: [...words].slice(0, 600), profile };
}

async function post<T>(settings: Settings, path: string, body: TutorRequest, parse: (x: unknown) => T): Promise<T> {
  if (!settings.aiEndpoint) throw new TutorError('Nie skonfigurowano adresu serwera AI.');
  if (!settings.aiConsent) throw new TutorError('Najpierw wyraź zgodę na wysyłanie wypowiedzi do serwera AI.');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const r = await fetch(new URL(path, settings.aiEndpoint), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(settings.aiToken ? { 'x-levada-token': settings.aiToken } : {}) },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) throw new TutorError(ERR_PL[json.error ?? ''] ?? `Błąd serwera AI (${r.status}).`);
    return parse(json);
  } catch (e) {
    if (e instanceof TutorError) throw e;
    if ((e as Error).name === 'AbortError') throw new TutorError('Serwer AI nie odpowiedział w czasie 90 s.');
    throw new TutorError('Nie udało się połączyć z serwerem AI. Sprawdź adres i połączenie z internetem.');
  } finally {
    clearTimeout(timer);
  }
}

export function tutorTurn(settings: Settings, req: TutorRequest): Promise<TutorTurn> {
  return post(settings, 'v1/tutor/turn', req, (x) => turnOutputSchema.parse(x));
}
export function tutorSummary(settings: Settings, req: TutorRequest): Promise<TutorSummary> {
  return post(settings, 'v1/tutor/summary', req, (x) => summaryOutputSchema.parse(x));
}

export async function checkHealth(endpoint: string): Promise<{ ok: boolean; mock: boolean; model: string | null }> {
  const r = await fetch(new URL('v1/health', endpoint));
  if (!r.ok) throw new TutorError(`Serwer odpowiedział kodem ${r.status}.`);
  return (await r.json()) as { ok: boolean; mock: boolean; model: string | null };
}
