/** Generator sesji Trybu Auto (czyste funkcje): polskie znaczenie → pauza → PT → pauza → PT. */

export type AutoStep =
  | { kind: 'pl'; text: string; itemId: string }
  | { kind: 'pt'; itemId: string; fem?: boolean; slow?: boolean }
  /** Fragment zdania (budowanie od końca) — czytany przez TTS. */
  | { kind: 'pt-text'; text: string; itemId: string }
  | { kind: 'pause'; ms: number; labelPl: string };

export type PolishPrompts = 'full' | 'reduced' | 'auto' | 'none';

export type AutoOptions = {
  /** Podpowiedzi po polsku: zawsze / co drugi raz / automatycznie (tylko dla słabo znanych) / bez. */
  polishPrompts: PolishPrompts;
  answerPauseMs: number;
  repeatPauseMs: number;
  /** Budowanie długich zdań od końca (np. „bem português” → „falo bem português” → całość). */
  backchain?: boolean;
};

export type AutoItem = { id: string; pl: string; pt: string; fem?: boolean; knownWell?: boolean };

export const DEFAULT_AUTO: AutoOptions = { polishPrompts: 'full', answerPauseMs: 3500, repeatPauseMs: 2500, backchain: true };

/** Fragmenty od końca zdania: dla 5+ słów — ostatnie 2, ostatnie 4… (bez całości). */
export function backchainFragments(pt: string): string[] {
  const words = pt.replace(/[.!?…]+$/g, '').split(/\s+/).filter(Boolean);
  if (words.length < 5) return [];
  const out: string[] = [];
  for (let n = 2; n < words.length; n += 2) out.push(words.slice(words.length - n).join(' ').replace(/^[,;:]+/, ''));
  return out;
}

export function buildAutoSteps(items: AutoItem[], o: AutoOptions): AutoStep[] {
  const steps: AutoStep[] = [];
  items.forEach((it, idx) => {
    const withPl =
      o.polishPrompts === 'full' || (o.polishPrompts === 'reduced' && idx % 2 === 0) || (o.polishPrompts === 'auto' && !it.knownWell);
    if (withPl) {
      steps.push({ kind: 'pl', text: it.pl, itemId: it.id });
      steps.push({ kind: 'pause', ms: o.answerPauseMs, labelPl: 'Powiedz po portugalsku…' });
    }
    steps.push({ kind: 'pt', itemId: it.id, fem: it.fem });
    steps.push({ kind: 'pause', ms: o.repeatPauseMs, labelPl: 'Powtórz' });
    if (o.backchain) {
      for (const f of backchainFragments(it.pt)) {
        steps.push({ kind: 'pt-text', text: f, itemId: it.id });
        steps.push({ kind: 'pause', ms: Math.round(o.repeatPauseMs * 0.8), labelPl: 'Powtórz fragment' });
      }
    }
    steps.push({ kind: 'pt', itemId: it.id, fem: it.fem });
    steps.push({ kind: 'pause', ms: 900, labelPl: '' });
  });
  return steps;
}

/** Indeksy początków bloków (jeden element = jeden blok) — do „następny” i wznawiania. */
export function blockStarts(steps: AutoStep[]): number[] {
  const out: number[] = [];
  let prevItem: string | null = null;
  steps.forEach((s, i) => {
    if (s.kind === 'pause') return;
    if (s.itemId !== prevItem) out.push(i);
    prevItem = s.itemId;
  });
  return out;
}

/** Przybliżony czas sesji w sekundach (zakładając ~2 s na wypowiedź). */
export function estimateSeconds(steps: AutoStep[]): number {
  return Math.round(steps.reduce((a, s) => a + (s.kind === 'pause' ? s.ms / 1000 : 2), 0));
}

/** Ile elementów zmieści się w zadanej liczbie minut (przybliżenie). */
export function itemsForMinutes(minutes: number, o: AutoOptions): number {
  const pl = o.polishPrompts === 'none' ? 0 : o.polishPrompts === 'full' ? 1 : 0.5;
  const per = pl * (2 + o.answerPauseMs / 1000) + 4 + o.repeatPauseMs / 1000 + 0.9 + (o.backchain ? 2 : 0);
  return Math.max(3, Math.floor((minutes * 60) / per));
}

export type SavedPlaylist = { date: string; kind: string; titlePl: string; minutes: number; prompts: PolishPrompts; itemIds: string[] };

const KEY_TOMORROW = 'levada-auto-playlist';
const KEY_PROGRESS = 'levada-auto-progress';

/** localStorage bywa niedostępny (tryb prywatny) — wszystko w try/catch, aplikacja działa bez tego. */
export function savePlaylist(p: SavedPlaylist) {
  try {
    localStorage.setItem(KEY_TOMORROW, JSON.stringify(p));
  } catch {
    /* brak pamięci przeglądarki — pomijamy */
  }
}
export function loadPlaylist(): SavedPlaylist | null {
  try {
    const raw = localStorage.getItem(KEY_TOMORROW);
    return raw ? (JSON.parse(raw) as SavedPlaylist) : null;
  } catch {
    return null;
  }
}
export function saveProgress(sessionKey: string, pos: number) {
  try {
    localStorage.setItem(KEY_PROGRESS, JSON.stringify({ sessionKey, pos, at: Date.now() }));
  } catch {
    /* pomijamy */
  }
}
/** Zapamiętana pozycja — ważna 12 godzin i tylko dla tej samej sesji. */
export function loadProgress(sessionKey: string): number {
  try {
    const raw = localStorage.getItem(KEY_PROGRESS);
    if (!raw) return 0;
    const p = JSON.parse(raw) as { sessionKey: string; pos: number; at: number };
    return p.sessionKey === sessionKey && Date.now() - p.at < 12 * 3_600_000 ? p.pos : 0;
  } catch {
    return 0;
  }
}
