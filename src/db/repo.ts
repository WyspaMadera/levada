/** Operacje na danych użytkownika (IndexedDB). */
import type { MistakeCategory, Skill } from '@/content/schema';
import { cardId, gradeFrom, isOverdue, newSkillCard, reviewSkillCard } from '@/lib/srs';
import { daysBetween, todayKey } from '@/lib/planner';
import type { RadarInput, SkillStat } from '@/lib/radar';
import {
  db,
  type ConversationLog,
  defaultSettings,
  type LessonProgress,
  type Profile,
  type SelfRating,
  type Settings,
  type SkillCard,
  type StudySession,
  type TestResult,
} from './db';

export async function ensureSettings(): Promise<Settings> {
  const s = await db.settings.get('settings');
  if (s) return { ...defaultSettings(), ...s };
  const d = defaultSettings();
  await db.settings.put(d);
  return d;
}

export async function updateSettings(patch: Partial<Settings>) {
  const s = await ensureSettings();
  await db.settings.put({ ...s, ...patch, id: 'settings' });
}

export async function getProfile(): Promise<Profile> {
  return (await db.profile.get('profile')) ?? { id: 'profile' };
}
export async function saveProfile(p: Profile) {
  await db.profile.put({ ...p, id: 'profile' });
}
export async function deleteProfile() {
  await db.profile.delete('profile');
}

// ---------- Lekcje
export async function startLesson(lessonId: string) {
  const p = await db.lessonProgress.get(lessonId);
  if (!p) await db.lessonProgress.put({ lessonId, status: 'started', step: 0, startedAt: new Date().toISOString(), completions: 0 });
}
export async function setLessonStep(lessonId: string, step: number) {
  await db.lessonProgress.update(lessonId, { step });
}

/** Ukończenie lekcji: zapis wyniku i utworzenie kart FSRS (nowe, do pierwszej powtórki). */
export async function completeLesson(args: {
  lessonId: string;
  score: number;
  newItemIds: string[];
  studyItemIds: string[];
  sentenceItemIds: string[];
}) {
  const now = new Date();
  await db.transaction('rw', db.lessonProgress, db.cards, async () => {
    const prev = await db.lessonProgress.get(args.lessonId);
    const lp: LessonProgress = {
      lessonId: args.lessonId,
      status: 'completed',
      step: 0,
      startedAt: prev?.startedAt ?? now.toISOString(),
      completedAt: now.toISOString(),
      score: args.score,
      bestScore: Math.max(prev?.bestScore ?? 0, args.score),
      completions: (prev?.completions ?? 0) + 1,
    };
    await db.lessonProgress.put(lp);
    const wanted: { itemId: string; skill: Skill }[] = [];
    for (const id of args.studyItemIds) {
      wanted.push({ itemId: id, skill: 'recognition' }, { itemId: id, skill: 'listening' });
    }
    for (const id of args.newItemIds) wanted.push({ itemId: id, skill: 'recall' }, { itemId: id, skill: 'speaking' });
    for (const id of args.sentenceItemIds) wanted.push({ itemId: id, skill: 'building' });
    const ids = wanted.map((w) => cardId(w.itemId, w.skill));
    const existing = new Set((await db.cards.bulkGet(ids)).filter(Boolean).map((c) => c!.id));
    const fresh = wanted.filter((w) => !existing.has(cardId(w.itemId, w.skill))).map((w) => newSkillCard(w.itemId, w.skill, now, args.lessonId));
    // unikalność (ten sam element może być i nowy, i w przykładach)
    const uniq = new Map(fresh.map((c) => [c.id, c]));
    await db.cards.bulkPut([...uniq.values()]);
  });
}

// ---------- Wyniki ćwiczeń i powtórek
export type ResultInput = {
  itemId?: string;
  skill: Skill;
  correct: boolean;
  self?: SelfRating;
  context: 'lesson' | 'review' | 'test';
  exerciseId?: string;
  lessonId?: string;
  answer?: string;
  mistake?: { category: MistakeCategory; expected: string; given: string; notePl?: string };
  /** Czy aktualizować harmonogram FSRS (w lekcji: tak, jeśli karta już istnieje lub tworzymy ją od razu). */
  schedule?: boolean;
};

export async function recordResult(r: ResultInput) {
  const now = new Date();
  const at = now.toISOString();
  await db.transaction('rw', [db.attempts, db.cards, db.reviewLogs, db.mistakes], async () => {
    await db.attempts.add({
      exerciseId: r.exerciseId ?? `${r.context}:${r.itemId ?? ''}:${r.skill}`,
      itemId: r.itemId,
      skill: r.skill,
      correct: r.correct,
      at,
      context: r.context,
      lessonId: r.lessonId,
      answer: r.answer,
    });
    if (r.itemId && r.schedule !== false) {
      const id = cardId(r.itemId, r.skill);
      const existing = await db.cards.get(id);
      const base = existing ?? newSkillCard(r.itemId, r.skill, now, r.lessonId);
      const grade = gradeFrom({ correct: r.correct, self: r.self });
      await db.cards.put(reviewSkillCard(base, grade, now));
      await db.reviewLogs.add({ cardId: id, itemId: r.itemId, skill: r.skill, rating: grade as 1 | 2 | 3 | 4, correct: r.correct, at, source: r.context });
    }
    if (!r.correct && r.mistake) {
      await db.mistakes.add({
        at,
        itemId: r.itemId,
        exerciseId: r.exerciseId,
        lessonId: r.lessonId,
        category: r.mistake.category,
        expected: r.mistake.expected,
        given: r.mistake.given,
        notePl: r.mistake.notePl,
        resolved: 0,
        correctStreak: 0,
      });
    } else if (r.correct && r.itemId) {
      // dwie kolejne poprawne odpowiedzi = błąd opanowany
      const open = await db.mistakes.where('itemId').equals(r.itemId).filter((m) => m.resolved === 0).toArray();
      for (const m of open) {
        const streak = m.correctStreak + 1;
        await db.mistakes.update(m.id!, streak >= 2 ? { correctStreak: streak, resolved: 1, resolvedAt: at } : { correctStreak: streak });
      }
    }
  });
}

export async function logSpeaking(entry: { taskId?: string; itemId?: string; selfRating: SelfRating; seconds: number; context: 'lesson' | 'review' | 'conversation' | 'test' | 'lab' }) {
  await db.speakingLogs.add({ ...entry, at: new Date().toISOString() });
}

export async function logStudy(kind: StudySession['kind'], seconds: number, speakingSeconds = 0) {
  if (seconds < 5) return;
  await db.studySessions.add({ date: todayKey(), seconds: Math.round(seconds), speakingSeconds: Math.round(speakingSeconds), kind });
}

export async function saveTestResult(r: Omit<TestResult, 'id' | 'at'>) {
  await db.testResults.add({ ...r, at: new Date().toISOString() });
}

// ---------- Rozmowy
export async function saveConversation(log: Omit<ConversationLog, 'id' | 'at'>) {
  return db.conversationLogs.add({ ...log, at: new Date().toISOString() });
}

// ---------- Nagrania
export async function saveRecording(rec: { itemId?: string; taskId?: string; label: string; blob: Blob; mime: string; durationMs: number }) {
  return db.recordings.add({ ...rec, at: new Date().toISOString() });
}
export async function deleteRecording(id: number) {
  await db.recordings.delete(id);
}
export async function deleteAllRecordings() {
  await db.recordings.clear();
}

// ---------- Analiza
export async function radarInput(now = new Date(), dailyMinutes: 5 | 15 | 30): Promise<RadarInput> {
  const since = new Date(now.getTime() - 14 * 86_400_000).toISOString();
  const attempts = await db.attempts.where('at').above(since).toArray();
  const recent: Partial<Record<Skill, SkillStat>> = {};
  for (const a of attempts) {
    const s = (recent[a.skill] ??= { correct: 0, total: 0 });
    s.total++;
    if (a.correct) s.correct++;
  }
  const cards = await db.cards.toArray();
  const overdue = cards.filter((c) => isOverdue(c, now) && new Date(c.due).getTime() < now.getTime() - 86_400_000).length;
  const mistakes = await db.mistakes.where('resolved').equals(0).toArray();
  const openMistakes: RadarInput['openMistakes'] = {};
  for (const m of mistakes) openMistakes[m.category] = (openMistakes[m.category] ?? 0) + 1;
  const completed = (await db.lessonProgress.where('status').equals('completed').toArray()).sort((a, b) =>
    (b.completedAt ?? '').localeCompare(a.completedAt ?? ''),
  );
  const last = completed[0];
  const sessions = await db.studySessions.orderBy('date').last();
  const days = sessions ? daysBetween(sessions.date, todayKey(now)) : null;
  return {
    recent,
    overdue,
    openMistakes,
    lastLessonScore: last?.score ?? null,
    lastLessonId: last?.lessonId ?? null,
    daysSinceLastActivity: days,
    dailyMinutes,
  };
}

export async function allCards(): Promise<SkillCard[]> {
  return db.cards.toArray();
}

export async function resetAllData() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
}
