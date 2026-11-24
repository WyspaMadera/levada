/** Porównywanie odpowiedzi użytkownika (wpisywanych / układanych z kafelków). */

export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[.,!?¿¡;:«»"“”…()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[n]!;
}

export type AnswerVerdict = 'correct' | 'accents' | 'typo' | 'wrong';

/**
 * correct — identycznie (bez względu na wielkość liter i interpunkcję);
 * accents — poprawnie poza znakami diakrytycznymi (liczone jako poprawne, z uwagą);
 * typo — jedna literówka w dłuższej odpowiedzi (liczone jako błąd, z łagodnym komunikatem);
 * wrong — błąd.
 */
export function judgeAnswer(input: string, accepted: string[]): AnswerVerdict {
  const a = normalizeAnswer(input);
  if (!a) return 'wrong';
  const acc = accepted.map(normalizeAnswer);
  if (acc.includes(a)) return 'correct';
  const aPlain = stripDiacritics(a);
  if (acc.some((x) => stripDiacritics(x) === aPlain)) return 'accents';
  if (acc.some((x) => x.length > 5 && levenshtein(stripDiacritics(x), aPlain) <= 1)) return 'typo';
  return 'wrong';
}

export function shuffle<T>(arr: readonly T[], rnd: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
