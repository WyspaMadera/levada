import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { LevadaDB } from '@/db/db';
import { content } from '@/content/content';
import { pickQuestions } from '@/screens/QuestionsSession';
import { levelFor } from '@/lib/aiTutor';
import { buildSystemPrompt, LEVEL_LIMITS, summaryOutputSchema, tutorRequestSchema, turnOutputSchema, TURN_SCHEMA, SUMMARY_SCHEMA } from '../../../server/tutor-protocol';

const req = tutorRequestSchema.parse({ level: 'A0', topic: 'rodzina', gender: 'f', canDo: ['Przedstawię się'], knownWords: ['olá'], history: [] });

describe('protokół trenera AI', () => {
  it('prompt: PT-PT, tylko znany materiał, bez danych osobowych bez zgody', () => {
    const [stable, ctx] = buildSystemPrompt(req, 'turn');
    expect(stable).toMatch(/European Portuguese/);
    expect(stable).toMatch(/Do not correct every small mistake/);
    expect(ctx).toMatch(/did not share personal details/);
    expect(ctx).toMatch(/feminine/);
  });
  it('po limicie wymian każe zakończyć rozmowę', () => {
    const hist = Array.from({ length: LEVEL_LIMITS.A0.maxLearnerTurns }, () => ({ role: 'learner' as const, text: 'Sim.' }));
    expect(buildSystemPrompt({ ...req, history: hist }, 'turn')[1]).toMatch(/Close the conversation politely now/);
  });
  it('schematy JSON zgodne z walidacją Zod', () => {
    expect(TURN_SCHEMA.required).toEqual(Object.keys(turnOutputSchema.shape).filter((k) => k !== 'mock'));
    expect(SUMMARY_SCHEMA.required).toEqual(Object.keys(summaryOutputSchema.shape).filter((k) => k !== 'mock'));
    expect(() => summaryOutputSchema.parse({ mainErrors: [{ learnerText: 'a', betterPt: 'b', explanationPl: 'c', category: 'zła' }], strengthsPl: [], nextStepPl: '' })).toThrow();
  });
  it('odrzuca zbyt długie dane', () => {
    expect(() => tutorRequestSchema.parse({ ...req, history: [{ role: 'learner', text: 'x'.repeat(601) }] })).toThrow();
  });
  it('poziom wg postępu, bez zawyżania', () => {
    expect(levelFor(0)).toBe('A0');
    expect(levelFor(24)).toBe('A1');
  });
});

describe('pytania bez scenariusza', () => {
  it('tylko odblokowane, najpierw najrzadziej ćwiczone', () => {
    const done = new Set(['w01-l02', 'w01-l04', 'w01-l05']);
    const picked = pickQuestions(content.questions, done, new Map([['q-nome', 5]]), 10, () => 0.5);
    expect(picked.length).toBeGreaterThan(0);
    expect(picked.every((q) => done.has(q.unlockAfterLessonId))).toBe(true);
    expect(picked[picked.length - 1]!.id).toBe('q-nome');
  });
  it('scenariusze mają co najmniej 2 wymiany i warianty odpowiedzi', () => {
    expect(content.scenarios.length).toBeGreaterThanOrEqual(10);
    expect(content.scenarios.every((s) => s.turns.length >= 2)).toBe(true);
    expect(content.scenarios.some((s) => s.turns.some((t) => t.answerItemIds.length > 1))).toBe(true);
  });
});

describe('migracja IndexedDB v1 → v2', () => {
  it('zachowuje dane i dodaje dziennik rozmów', async () => {
    const name = 'levada-migration-test';
    await Dexie.delete(name);
    const v1 = new Dexie(name);
    v1.version(1).stores({ settings: 'id', lessonProgress: 'lessonId, status', cards: 'id, itemId, skill, due, state' });
    await v1.open();
    await v1.table('lessonProgress').put({ lessonId: 'w01-l01', status: 'completed', step: 0, startedAt: 'x', completions: 1 });
    v1.close();
    const v2 = new LevadaDB(name);
    await v2.open();
    expect(v2.verno).toBe(3);
    expect((await v2.lessonProgress.get('w01-l01'))?.status).toBe('completed');
    await v2.conversationLogs.add({ at: 'x', kind: 'questions', turns: [], seconds: 1, speakingSeconds: 0 });
    expect(await v2.conversationLogs.count()).toBe(1);
    v2.close();
  });
});
