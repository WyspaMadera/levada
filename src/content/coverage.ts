/**
 * Udział znanych słów w tekście. Uproszczona lematyzacja: identyczna forma, liczba mnoga (-s/-es)
 * oraz formy wpisane do słowniczka czytanki z odnośnikiem do poznanego elementu.
 * To SZACUNEK — w aplikacji pokazujemy go z takim opisem.
 */
import type { ContentIndex } from './index';
import type { Lesson, Reading } from './schema';

const WORD_RE = /[\p{L}]+/gu;

export function wordsOf(text: string): string[] {
  return (text.toLowerCase().match(WORD_RE) ?? []).filter(Boolean);
}

export function isKnownForm(known: Set<string>, w: string): boolean {
  if (known.has(w)) return true;
  if (w.endsWith('es') && known.has(w.slice(0, -2))) return true;
  if (w.endsWith('s') && known.has(w.slice(0, -1))) return true;
  return false;
}

/** Słowa poznane do danej lekcji włącznie (nowe słowa, rozgrzewki, przykłady, tabele, dialogi). */
export function knownWordsUpTo(idx: ContentIndex, lessonId: string): Set<string> {
  const target = idx.lessonById.get(lessonId);
  const known = new Set<string>();
  if (!target) return known;
  const ord = (l: Lesson) => l.week * 10 + l.day;
  for (const l of idx.lessons) {
    if (ord(l) > ord(target)) continue;
    const ids = [
      ...l.newItemIds,
      ...l.warmup.itemIds,
      ...(l.grammar?.exampleIds ?? []),
      ...(l.grammar?.tableItemIds ?? []),
      ...l.dialogueIds.flatMap((d) => idx.dialogues.get(d)?.lines.map((x) => x.itemId) ?? []),
    ];
    for (const id of ids) {
      const it = idx.items.get(id);
      if (!it) continue;
      for (const t of [it.pt, it.ptFem]) if (t) for (const w of wordsOf(t)) known.add(w);
    }
  }
  return known;
}

export type Coverage = { total: number; known: number; ratio: number; unknown: string[] };

export function readingCoverage(idx: ContentIndex, r: Reading): Coverage {
  const known = knownWordsUpTo(idx, r.unlockAfterLessonId);
  // słowniczek z odnośnikiem do poznanego elementu = forma odmieniona znanego słowa
  for (const g of r.glossary) if (g.itemId && idx.items.has(g.itemId)) known.add(g.form.toLowerCase());
  const words = r.sentenceItemIds.flatMap((id) => wordsOf(idx.items.get(id)?.pt ?? ''));
  const unknown = words.filter((w) => !isKnownForm(known, w));
  return { total: words.length, known: words.length - unknown.length, ratio: words.length ? (words.length - unknown.length) / words.length : 0, unknown: [...new Set(unknown)] };
}
