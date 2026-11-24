/** Analiza trudności — konkretne liczby z historii nauki (czyste funkcje). */
import type { MistakeCategory, Skill } from '@/content/schema';
import type { Attempt, Mistake, SkillCard, StudySession } from '@/db/db';

const DAY = 86_400_000;

export function mistakeTrend(mistakes: Mistake[], now: Date) {
  const t = now.getTime();
  const out = new Map<MistakeCategory, { recent: number; previous: number }>();
  for (const m of mistakes) {
    const age = t - new Date(m.at).getTime();
    if (age > 28 * DAY) continue;
    const e = out.get(m.category) ?? { recent: 0, previous: 0 };
    if (age <= 14 * DAY) e.recent++;
    else e.previous++;
    out.set(m.category, e);
  }
  return [...out.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.recent - a.recent);
}

/** Najtrudniejsze elementy: najwięcej „zapomnień” (lapses), potem najwyższa trudność FSRS. */
export function hardestItems(cards: SkillCard[], n = 5) {
  const byItem = new Map<string, { itemId: string; lapses: number; difficulty: number }>();
  for (const c of cards) {
    const e = byItem.get(c.itemId) ?? { itemId: c.itemId, lapses: 0, difficulty: 0 };
    e.lapses += c.lapses;
    e.difficulty = Math.max(e.difficulty, c.difficulty);
    byItem.set(c.itemId, e);
  }
  return [...byItem.values()].filter((e) => e.lapses > 0).sort((a, b) => b.lapses - a.lapses || b.difficulty - a.difficulty).slice(0, n);
}

export type WeekStat = { weekStart: string; bySkill: Partial<Record<Skill, { correct: number; total: number }>>; minutes: number };

/** Ostatnie `weeks` tygodni (pon–nd): trafność wg kompetencji i minuty nauki. */
export function weeklyStats(attempts: Attempt[], sessions: StudySession[], now: Date, weeks = 4): WeekStat[] {
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const starts = Array.from({ length: weeks }, (_, i) => new Date(monday.getTime() - (weeks - 1 - i) * 7 * DAY));
  const idx = (d: Date) => starts.findIndex((s, i) => d >= s && (i === starts.length - 1 || d < starts[i + 1]!));
  const out: WeekStat[] = starts.map((s) => ({ weekStart: s.toISOString().slice(0, 10), bySkill: {}, minutes: 0 }));
  for (const a of attempts) {
    const i = idx(new Date(a.at));
    if (i < 0) continue;
    const e = (out[i]!.bySkill[a.skill] ??= { correct: 0, total: 0 });
    e.total++;
    if (a.correct) e.correct++;
  }
  for (const s of sessions) {
    const i = idx(new Date(`${s.date}T12:00:00`));
    if (i >= 0) out[i]!.minutes += s.seconds / 60;
  }
  out.forEach((w) => (w.minutes = Math.round(w.minutes)));
  return out;
}
