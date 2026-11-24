import Dexie, { type EntityTable } from 'dexie';
import type { MistakeCategory, Skill } from '@/content/schema';
import type { State } from 'ts-fsrs';

export type DailyMinutes = 5 | 15 | 30;
export type PlaybackRate = 0.75 | 1 | 1.15;

export type Settings = {
  id: 'settings';
  onboardingDone: boolean;
  createdAt: string;
  /** Forma wypowiedzi użytkownika: obrigado (m) / obrigada (f). */
  gender: 'm' | 'f';
  dailyMinutes: DailyMinutes;
  showPronunciation: boolean;
  showIpa: boolean;
  playbackRate: PlaybackRate;
  repeatCount: 1 | 2 | 3;
  voiceURI: string | null;
  /** Świadoma zgoda na głos pt-BR, gdy brak pt-PT (domyślnie wyłączone). */
  allowBrFallback: boolean;
  theme: 'system' | 'light' | 'dark';
  autoPlayAudio: boolean;
  /** Trener AI (opcjonalny): adres serwera pośredniczącego, token, zgody. */
  aiEndpoint: string | null;
  aiToken: string | null;
  /** Świadoma zgoda na wysyłanie wypowiedzi do serwera AI. */
  aiConsent: boolean;
  /** Zgoda na dołączanie danych z życiorysu (imię, miasto, praca, zainteresowania). */
  aiShareProfile: boolean;
  /** Dzień, dla którego użytkownik zmienił czas nauki („dziś mam tylko 5 minut”). */
  todayOverride?: { date: string; minutes: DailyMinutes };
};

export type Profile = {
  id: 'profile';
  name?: string;
  city?: string;
  country?: string;
  job?: string;
  interests?: string;
  family?: string;
  sinceMadeira?: string;
  /** Całkowicie opcjonalne. */
  childNote?: string;
};

export type LessonProgress = {
  lessonId: string;
  status: 'started' | 'completed';
  step: number;
  startedAt: string;
  completedAt?: string;
  /** Wynik ostatniego ukończenia 0–1 (ćwiczenia oceniane automatycznie). */
  score?: number;
  bestScore?: number;
  completions: number;
};

/** Karta FSRS dla pary (element, kompetencja). */
export type SkillCard = {
  id: string; // `${itemId}|${skill}`
  itemId: string;
  skill: Skill;
  lessonId?: string;
  createdAt: string;
  due: Date;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: Date;
};

export type ReviewLogEntry = {
  id?: number;
  cardId: string;
  itemId: string;
  skill: Skill;
  rating: 1 | 2 | 3 | 4;
  correct: boolean;
  at: string;
  source: 'lesson' | 'review' | 'test' | 'speaking';
};

export type Attempt = {
  id?: number;
  exerciseId: string;
  itemId?: string;
  skill: Skill;
  correct: boolean;
  at: string;
  context: 'lesson' | 'review' | 'test';
  lessonId?: string;
  answer?: string;
};

export type Mistake = {
  id?: number;
  at: string;
  itemId?: string;
  exerciseId?: string;
  lessonId?: string;
  category: MistakeCategory;
  expected: string;
  given: string;
  notePl?: string;
  /** 0 = otwarty, 1 = opanowany (IndexedDB nie indeksuje wartości logicznych). */
  resolved: 0 | 1;
  resolvedAt?: string;
  correctStreak: number;
};

export type SelfRating = 'can' | 'almost' | 'cannot';

export type SpeakingLog = {
  id?: number;
  at: string;
  taskId?: string;
  itemId?: string;
  selfRating: SelfRating;
  seconds: number;
  context: 'lesson' | 'review' | 'conversation' | 'test' | 'lab';
};

export type Recording = {
  id?: number;
  at: string;
  itemId?: string;
  taskId?: string;
  label: string;
  blob: Blob;
  mime: string;
  durationMs: number;
};

export type TestResult = {
  id?: number;
  testId: string;
  at: string;
  score: number;
  sections: { titlePl: string; skill: Skill; correct: number; total: number }[];
  speaking: { taskId: string; selfRating: SelfRating }[];
  /** Monologi: ile punktów listy kontrolnej zaznaczono (samoocena) i czas mówienia. */
  monologues?: { id: string; checked: number; total: number; seconds: number }[];
  /** Symulacje rozmów: samoocena każdej wymiany. */
  scenarios?: { id: string; ratings: SelfRating[] }[];
};

export type ConversationTurnLog = {
  speaker: 'other' | 'learner';
  itemId?: string;
  text?: string;
  self?: SelfRating;
};

export type ConversationLog = {
  id?: number;
  at: string;
  kind: 'scenario' | 'questions' | 'dialogue' | 'ai' | 'courage';
  refId?: string;
  level?: string;
  turns: ConversationTurnLog[];
  seconds: number;
  speakingSeconds: number;
  /** Podsumowanie AI (niezweryfikowane) — tylko w trybie AI. */
  aiSummary?: { mainErrors: { learnerText: string; betterPt: string; explanationPl: string; category: string }[]; strengthsPl: string[]; nextStepPl: string; mock?: boolean };
};

/** „Moje zdania”: zapisany element kursu albo własne zdanie użytkownika (bez zapisu wymowy). */
export type MyPhrase = {
  id?: number;
  at: string;
  itemId?: string;
  customPt?: string;
  customPl?: string;
  source: 'lesson' | 'cheatsheet' | 'reading' | 'custom' | 'other';
};

export type MissionLog = {
  id?: number;
  missionId: string;
  at: string;
  self: SelfRating;
  notePl?: string;
};

export type StudySession = {
  id?: number;
  date: string; // YYYY-MM-DD (czas lokalny)
  seconds: number;
  speakingSeconds: number;
  kind: 'lesson' | 'review' | 'lab' | 'conversation' | 'listening' | 'test' | 'speaking';
};

export class LevadaDB extends Dexie {
  settings!: EntityTable<Settings, 'id'>;
  profile!: EntityTable<Profile, 'id'>;
  lessonProgress!: EntityTable<LessonProgress, 'lessonId'>;
  cards!: EntityTable<SkillCard, 'id'>;
  reviewLogs!: EntityTable<ReviewLogEntry, 'id'>;
  attempts!: EntityTable<Attempt, 'id'>;
  mistakes!: EntityTable<Mistake, 'id'>;
  speakingLogs!: EntityTable<SpeakingLog, 'id'>;
  recordings!: EntityTable<Recording, 'id'>;
  testResults!: EntityTable<TestResult, 'id'>;
  studySessions!: EntityTable<StudySession, 'id'>;
  conversationLogs!: EntityTable<ConversationLog, 'id'>;
  myPhrases!: EntityTable<MyPhrase, 'id'>;
  missionLogs!: EntityTable<MissionLog, 'id'>;

  constructor(name = 'levada') {
    super(name);
    // Migracje: każda zmiana schematu = nowa wersja z .upgrade(), stare wersje zostają.
    this.version(1).stores({
      settings: 'id',
      profile: 'id',
      lessonProgress: 'lessonId, status',
      cards: 'id, itemId, skill, due, state',
      reviewLogs: '++id, cardId, itemId, skill, at',
      attempts: '++id, exerciseId, skill, at, context',
      mistakes: '++id, category, itemId, resolved, at',
      speakingLogs: '++id, at, taskId',
      recordings: '++id, itemId, at',
      testResults: '++id, testId, at',
      studySessions: '++id, date',
    });
    // v2 (etap 5): dziennik rozmów. Pozostałe tabele bez zmian; nowe pola ustawień uzupełnia defaultSettings().
    this.version(2).stores({ conversationLogs: '++id, at, kind' });
    // v3 (etap 7): Moje zdania i dziennik misji.
    this.version(3).stores({ myPhrases: '++id, itemId, at', missionLogs: '++id, missionId, at' });
  }
}

export const db = new LevadaDB();

export const DB_TABLES = [
  'settings',
  'profile',
  'lessonProgress',
  'cards',
  'reviewLogs',
  'attempts',
  'mistakes',
  'speakingLogs',
  'testResults',
  'studySessions',
  'conversationLogs',
  'myPhrases',
  'missionLogs',
] as const;
export type BackupTable = (typeof DB_TABLES)[number];

export function defaultSettings(): Settings {
  return {
    id: 'settings',
    onboardingDone: false,
    createdAt: new Date().toISOString(),
    gender: 'm',
    dailyMinutes: 15,
    showPronunciation: true,
    showIpa: false,
    playbackRate: 1,
    repeatCount: 1,
    voiceURI: null,
    allowBrFallback: false,
    theme: 'system',
    autoPlayAudio: true,
    aiEndpoint: null,
    aiToken: null,
    aiConsent: false,
    aiShareProfile: false,
  };
}
