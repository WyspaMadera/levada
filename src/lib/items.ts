/** Pomocnicze funkcje do elementów treści (forma męska/żeńska, dystraktory, kafelki). */
import { content } from '@/content/content';
import type { LearningItem, Pronunciation } from '@/content/schema';
import { shuffle } from './answers';

export type Gender = 'm' | 'f';

export function getItem(id: string): LearningItem {
  const it = content.items.get(id);
  if (!it) throw new Error(`Brak elementu treści: ${id}`);
  return it;
}

export function maybeItem(id: string): LearningItem | undefined {
  return content.items.get(id);
}

export type ItemView = { pt: string; pl: string; pron: Pronunciation; fem: boolean };

/** Forma dopasowana do użytkownika (obrigado/obrigada). */
export function itemView(item: LearningItem, gender: Gender, forceFem?: boolean): ItemView {
  const fem = (forceFem ?? gender === 'f') && Boolean(item.ptFem && item.pronunciationFem);
  return fem
    ? { pt: item.ptFem!, pl: item.plFem ?? item.pl, pron: item.pronunciationFem!, fem: true }
    : { pt: item.pt, pl: item.pl, pron: item.pronunciation, fem: false };
}

/** Akceptowane odpowiedzi PT (obie formy rodzaju). */
export function acceptedPt(item: LearningItem): string[] {
  return [item.pt, item.ptFem].filter((s): s is string => Boolean(s)).map((s) => s.replace(/…|\.\.\./g, '').trim());
}

/** Dystraktory: inne elementy tego samego rodzaju z poznanego materiału, o innym znaczeniu. */
export function distractors(target: LearningItem, pool: string[], n: number, rnd = Math.random): LearningItem[] {
  const out: LearningItem[] = [];
  const seenPl = new Set([target.pl]);
  const candidates = shuffle(
    pool.map((id) => content.items.get(id)).filter((x): x is LearningItem => Boolean(x) && x!.id !== target.id),
    rnd,
  ).sort((a, b) => Number(b.kind === target.kind) - Number(a.kind === target.kind));
  for (const c of candidates) {
    if (out.length >= n) break;
    if (seenPl.has(c.pl) || c.pt === target.pt) continue;
    seenPl.add(c.pl);
    out.push(c);
  }
  return out;
}

/** Kafelki do ułożenia zdania z tekstu PT (bez interpunkcji końcowej). */
export function tilesFor(pt: string): string[] {
  return pt
    .replace(/[.!?…]+$/g, '')
    .replace(/[,;:]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}
