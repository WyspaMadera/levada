import { z } from 'zod';

export const LEVELS = ['A0', 'A1', 'A2', 'B1'] as const;
export const levelSchema = z.enum(LEVELS);
export type Level = z.infer<typeof levelSchema>;

export const reviewStatusSchema = z.enum(['draft', 'automatedChecked', 'humanVerified']);
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ID: małe litery, cyfry, myślniki');

export const pronunciationSchema = z.object({
  /** Wersja dydaktyczna „Fonetyka PL” (PRONUNCIATION.md). */
  plSlow: z.string().min(1).optional(),
  /** Wersja naturalna (łączenia, redukcje) — tylko gdy różni się istotnie. */
  plNatural: z.string().min(1).optional(),
  ipa: z.string().min(1).optional(),
  /** Opcjonalny opis akcentu; domyślnie wyprowadzany z WIELKICH liter w plSlow. */
  stress: z.string().optional(),
  notePl: z.string().optional(),
  needsReview: z.boolean(),
});
export type Pronunciation = z.infer<typeof pronunciationSchema>;

export const audioRefSchema = z.object({
  normal: z.string().optional(),
  slow: z.string().optional(),
  voiceLocale: z.literal('pt-PT'),
});

export const learningItemSchema = z
  .object({
    id,
    kind: z.enum(['word', 'phrase', 'sentence']),
    pt: z.string().min(1),
    /** Forma żeńska (np. obrigada) — gdy mówi kobieta / dotyczy kobiety. */
    ptFem: z.string().optional(),
    pl: z.string().min(1),
    plFem: z.string().optional(),
    /** Tekst dla TTS, jeśli inny niż `pt` (np. bez wielokropka). */
    tts: z.string().optional(),
    ttsFem: z.string().optional(),
    pronunciation: pronunciationSchema,
    pronunciationFem: pronunciationSchema.optional(),
    audio: audioRefSchema.optional(),
    level: levelSchema,
    tags: z.array(z.string()),
    region: z.enum(['madeira', 'portugal']).optional(),
    standardEquivalentId: id.optional(),
    /** Krótka uwaga o użyciu (rejestr, grzeczność) po polsku. */
    usagePl: z.string().optional(),
    /** Formalność wypowiedzi: formal = o senhor/a senhora, informal = tu. */
    register: z.enum(['formal', 'informal', 'neutral']).optional(),
    reviewStatus: reviewStatusSchema,
    verifiedBy: z.string().optional(),
    verifiedAt: z.string().optional(),
    references: z.array(z.string()).optional(),
    /** Reguły lintera świadomie zaakceptowane przez autora/recenzenta dla tej pozycji (np. „proclisis-start” dla „Se faz favor”). */
    lintAllow: z.array(z.string()).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.reviewStatus === 'humanVerified' && (!v.verifiedBy || !v.verifiedAt)) {
      ctx.addIssue({ code: 'custom', message: 'humanVerified wymaga pól verifiedBy i verifiedAt' });
    }
    if (v.ptFem && !v.pronunciationFem) {
      ctx.addIssue({ code: 'custom', message: 'ptFem wymaga pronunciationFem' });
    }
    if (v.region === 'madeira' && !v.references?.length) {
      ctx.addIssue({ code: 'custom', message: 'Regionalizm Madery wymaga źródła (references)' });
    }
  });
export type LearningItem = z.infer<typeof learningItemSchema>;

export const lessonSchema = z.object({
  id,
  week: z.number().int().min(1).max(26),
  day: z.number().int().min(1).max(7),
  phase: z.number().int().min(1),
  titlePl: z.string().min(1),
  subtitlePl: z.string().optional(),
  goals: z.array(z.string()).min(1),
  /** „Co umiem powiedzieć” — konkretne umiejętności (do podsumowania i ekranu Postępy). */
  canDo: z.array(z.string()).min(1),
  prerequisites: z.array(id),
  estimatedMinutes: z.number().int().min(3).max(30),
  warmup: z.object({ soundId: id, textPl: z.string(), itemIds: z.array(id) }),
  newItemIds: z.array(id),
  grammar: z
    .object({
      titlePl: z.string(),
      /** Akapity rozdzielone pustą linią; **pogrubienie** dozwolone. */
      explanationPl: z.string(),
      /** Tabela (np. odmiana czasownika) — wiersze [pt, pl]. */
      table: z.array(z.tuple([z.string(), z.string()])).optional(),
      /** Tabela z elementów (np. odmiana czasownika) — każdy wiersz z wymową i odsłuchem. */
      tableItemIds: z.array(id).optional(),
      exampleIds: z.array(id),
    })
    .optional(),
  dialogueIds: z.array(id),
  exerciseIds: z.array(id).min(1),
  speakingTaskIds: z.array(id),
  testId: id.optional(),
  mapStopId: id,
  status: z.enum(['draft', 'review', 'published']),
});
export type Lesson = z.infer<typeof lessonSchema>;

export const dialogueSchema = z.object({
  id,
  titlePl: z.string(),
  contextPl: z.string(),
  level: levelSchema,
  lines: z
    .array(
      z.object({
        speaker: z.string(),
        /** Czy kwestię wypowiada użytkownik (do trybu rozmowy). */
        isLearner: z.boolean().optional(),
        /** Pokaż formę żeńską elementu (ptFem), np. gdy mówi kobieta. */
        fem: z.boolean().optional(),
        itemId: id,
      }),
    )
    .min(2),
});
export type Dialogue = z.infer<typeof dialogueSchema>;

export const skillSchema = z.enum(['listening', 'recognition', 'recall', 'building', 'speaking']);
export type Skill = z.infer<typeof skillSchema>;

export const mistakeCategorySchema = z.enum([
  'meaning',
  'listening',
  'ser-estar',
  'conjugation',
  'gender-article',
  'word-order',
  'politeness',
  'pronunciation',
  'building',
  'vocabulary',
]);
export type MistakeCategory = z.infer<typeof mistakeCategorySchema>;

const exBase = {
  id,
  promptPl: z.string().optional(),
  mistakeCategory: mistakeCategorySchema.optional(),
  explanationPl: z.string().optional(),
};

export const exerciseSchema = z.discriminatedUnion('type', [
  /** Słyszę PT → wybieram znaczenie PL. */
  z.object({ ...exBase, type: z.literal('listenChoose'), targetItemId: id, optionItemIds: z.array(id).min(2) }),
  /** Widzę PT → wybieram PL. */
  z.object({ ...exBase, type: z.literal('readChoose'), targetItemId: id, optionItemIds: z.array(id).min(2) }),
  /** Widzę PL → wybieram właściwe PT. */
  z.object({ ...exBase, type: z.literal('recallChoose'), targetItemId: id, optionItemIds: z.array(id).min(2) }),
  /** Widzę PL → mówię PT na głos → odsłaniam → samoocena. */
  z.object({ ...exBase, type: z.literal('recallSay'), targetItemId: id }),
  /** Widzę PL → wpisuję PT (tolerancja na brak akcentów, z informacją). */
  z.object({ ...exBase, type: z.literal('typeAnswer'), targetItemId: id, acceptedAnswers: z.array(z.string()).optional() }),
  /** Układam zdanie z kafelków. */
  z.object({
    ...exBase,
    type: z.literal('buildSentence'),
    targetItemId: id,
    tiles: z.array(z.string()).min(2),
    distractors: z.array(z.string()).optional(),
    acceptedAnswers: z.array(z.string()).optional(),
  }),
  /** „Jedno zdanie — wiele możliwości”: przekształć zdanie bazowe. */
  z.object({
    ...exBase,
    type: z.literal('transform'),
    baseItemId: id,
    instructionPl: z.string(),
    targetItemId: id,
    tiles: z.array(z.string()).min(2),
    distractors: z.array(z.string()).optional(),
    acceptedAnswers: z.array(z.string()).optional(),
  }),
  /** Luka w zdaniu. */
  z.object({
    ...exBase,
    type: z.literal('fillGap'),
    sentencePt: z.string().includes('___'),
    sentencePl: z.string(),
    options: z.array(z.string()).min(2),
    answer: z.string(),
    fullItemId: id.optional(),
    /** Wyjaśnienia błędnych odpowiedzi: opcja → wyjaśnienie. */
    wrongExplanations: z.record(z.string(), z.string()).optional(),
  }),
  /** Para minimalna: odtwarzam jedno z dwóch słów, użytkownik rozpoznaje które. */
  z.object({ ...exBase, type: z.literal('minimalPair'), itemIds: z.tuple([id, id]) }),
]);
export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseType = Exercise['type'];

export const EXERCISE_SKILL: Record<ExerciseType, Skill> = {
  listenChoose: 'listening',
  minimalPair: 'listening',
  readChoose: 'recognition',
  recallChoose: 'recall',
  typeAnswer: 'recall',
  recallSay: 'speaking',
  buildSentence: 'building',
  transform: 'building',
  fillGap: 'building',
};

export const speakingTaskSchema = z.object({
  id,
  promptPl: z.string(),
  hintPl: z.string().optional(),
  /** Przykładowe odpowiedzi (z wymową). */
  modelItemIds: z.array(id).min(1),
  /** Zadanie osobiste: wzór zdania z polem z profilu (np. imię). Wymowy pola nie zgadujemy. */
  personal: z
    .object({
      field: z.enum(['name', 'city', 'country', 'job']),
      /** Wzór z {field}, np. "Chamo-me {name}." */
      templatePt: z.string(),
      templateItemId: id,
    })
    .optional(),
});
export type SpeakingTask = z.infer<typeof speakingTaskSchema>;

const personalSchema = z.object({
  field: z.enum(['name', 'city', 'country', 'job']),
  templatePt: z.string(),
  templateItemId: id,
});

/** Scenariusz rozmowy: rozmówca mówi → użytkownik odpowiada SAM; kilka poprawnych wariantów odpowiedzi. */
export const conversationScenarioSchema = z.object({
  id,
  titlePl: z.string(),
  topicPl: z.string(),
  level: levelSchema,
  /** Scenariusz dostępny po ukończeniu tej lekcji. */
  unlockAfterLessonId: id,
  contextPl: z.string(),
  turns: z
    .array(
      z.object({
        speaker: z.string(),
        promptItemId: id,
        /** Pokaż formę żeńską kwestii rozmówcy. */
        promptFem: z.boolean().optional(),
        /** Co masz zrobić (po polsku). */
        taskPl: z.string(),
        /** Poprawne warianty odpowiedzi (każdy z wymową). */
        answerItemIds: z.array(id).min(1),
        personal: personalSchema.optional(),
      }),
    )
    .min(2),
});
export type ConversationScenario = z.infer<typeof conversationScenarioSchema>;

/** Pytanie otwarte („bez scenariusza”): odpowiadasz o sobie, nie ma jednej poprawnej odpowiedzi. */
export const openQuestionSchema = z.object({
  id,
  questionItemId: id,
  unlockAfterLessonId: id,
  topicPl: z.string(),
  hintPl: z.string(),
  exampleAnswerItemIds: z.array(id).min(1),
  /** Słowa/zwroty, które mogą się przydać (podpowiedź). */
  usefulItemIds: z.array(id),
  personal: personalSchema.optional(),
});
export type OpenQuestion = z.infer<typeof openQuestionSchema>;

/** Czytanka: zdania są elementami (z wymową); słowniczek dla „dotknij słowa”; pytania sprawdzające. */
export const readingSchema = z.object({
  id,
  titlePl: z.string(),
  titlePt: z.string(),
  level: levelSchema,
  unlockAfterLessonId: id,
  topicPl: z.string(),
  sentenceItemIds: z.array(id).min(2),
  /** Formy słów występujące w tekście (małymi literami) → znaczenie; opcjonalnie odnośnik do elementu. */
  glossary: z.array(z.object({ form: z.string(), pl: z.string(), itemId: id.optional(), notePl: z.string().optional() })).min(1),
  questions: z
    .array(z.object({ questionPl: z.string(), options: z.array(z.string()).min(2), answerIndex: z.number().int().min(0), explanationPl: z.string().optional() }))
    .min(1),
});
export type Reading = z.infer<typeof readingSchema>;

/** Ściągawka sytuacyjna — dostępna niezależnie od postępów w kursie. */
export const cheatsheetSchema = z.object({
  id,
  order: z.number().int(),
  group: z.enum(['dziecko', 'urzedy', 'praca-turystyka', 'codziennosc']),
  titlePl: z.string(),
  descriptionPl: z.string(),
  /** Instytucja — tylko zweryfikowane dane (nazwa, strona, data weryfikacji). */
  institution: z
    .object({
      namePt: z.string(),
      namePl: z.string(),
      url: z.string().url().optional(),
      verifiedAt: z.string(),
      /** page = strona otwarta i przeczytana; search = tylko wyniki wyszukiwarki (słabsza weryfikacja). */
      verifiedHow: z.enum(['page', 'search']),
      notePl: z.string().optional(),
    })
    .optional(),
  disclaimerPl: z.string().optional(),
  phrases: z.array(z.object({ itemId: id, harder: z.boolean().optional() })).min(3),
});
export type Cheatsheet = z.infer<typeof cheatsheetSchema>;

export const LIBRARY_LEVELS = ['poczatkujacy', 'A1', 'A2', 'B1', 'naturalny', 'madera'] as const;
/** Zewnętrzne źródło do słuchania — tylko zweryfikowane (adres sprawdzony w dniu verifiedAt). */
export const librarySourceSchema = z.object({
  id,
  name: z.string(),
  kind: z.enum(['podcast', 'youtube', 'radio', 'website', 'tool']),
  levels: z.array(z.enum(LIBRARY_LEVELS)).min(1),
  url: z.string().url(),
  descriptionPl: z.string(),
  variant: z.enum(['pt-PT', 'mixed', 'unknown']),
  transcript: z.enum(['yes', 'partial', 'no', 'unknown']),
  cost: z.enum(['free', 'freemium', 'paid', 'unknown']),
  approxTimePl: z.string().optional(),
  verifiedAt: z.string(),
  verifiedHow: z.enum(['page', 'search']),
  notesPl: z.string().optional(),
});
export type LibrarySource = z.infer<typeof librarySourceSchema>;

/** Sekcja „Mojego życiorysu”: wzory zdań (zweryfikowane szablony) odblokowywane z postępem. */
export const biographySectionSchema = z.object({
  id,
  order: z.number().int(),
  titlePl: z.string(),
  unlockAfterLessonId: id,
  hintPl: z.string(),
  templates: z.array(z.object({ itemId: id, personal: personalSchema.optional(), optional: z.boolean().optional() })).min(1),
});
export type BiographySection = z.infer<typeof biographySectionSchema>;

/** Misja w prawdziwym życiu: użyj zwrotu poza aplikacją. */
export const missionSchema = z.object({
  id,
  unlockAfterLessonId: id,
  titlePl: z.string(),
  taskPl: z.string(),
  tipPl: z.string(),
  phraseItemIds: z.array(id).min(1),
});
export type Mission = z.infer<typeof missionSchema>;

/** Obszar kompetencji (mapa kompetencji) — powiązany z tagami elementów i lekcjami. */
export const competenceAreaSchema = z.object({
  id,
  order: z.number().int(),
  titlePl: z.string(),
  canDoPl: z.array(z.string()).min(1),
  tags: z.array(z.string()).min(1),
  lessonIds: z.array(id).min(1),
});
export type CompetenceArea = z.infer<typeof competenceAreaSchema>;

export const testSchema = z.object({
  id,
  week: z.number().int().min(1).max(26),
  kind: z.enum(['micro', 'weekly', 'stage', 'final']),
  titlePl: z.string(),
  introPl: z.string(),
  sections: z
    .array(z.object({ titlePl: z.string(), skill: skillSchema, exerciseIds: z.array(id).min(1) }))
    .min(1),
  speakingTaskIds: z.array(id),
  /** Monologi: wypowiedź na czas, oceniana listą kontrolną (samoocena). */
  monologues: z
    .array(z.object({ id, promptPl: z.string(), hintPl: z.string().optional(), targetSeconds: z.number().int().min(20).max(300), checklistPl: z.array(z.string()).min(2) }))
    .optional(),
  /** Symulacje rozmów (scenariusze z content/conversations). */
  scenarioIds: z.array(id).optional(),
  /** Próg (0–1) rekomendacji „gotowy na dalszy materiał”. Nigdy nie blokuje nauki. */
  passThreshold: z.number().min(0).max(1),
  /** Lekcje do powtórki, jeśli wynik w sekcji jest słaby. */
  remedialLessonIds: z.array(id),
});
export type Test = z.infer<typeof testSchema>;

export const soundSchema = z.object({
  id,
  order: z.number().int(),
  titlePl: z.string(),
  symbol: z.string(),
  ipa: z.string(),
  group: z.enum(['vowels', 'nasals', 'consonants', 'prosody']),
  /** Przewaga Polaka / pułapka Polaka / neutralne. */
  polish: z.enum(['advantage', 'trap', 'neutral']),
  summaryPl: z.string(),
  explanationPl: z.string(),
  mouth: z.object({ lips: z.string(), tongue: z.string(), extraPl: z.string().optional() }),
  polishComparisonPl: z.string(),
  /** Samogłoski do podświetlenia na schemacie (IPA). */
  vowelChart: z.array(z.string()).optional(),
  exampleItemIds: z.array(id),
  minimalPairs: z.array(z.tuple([id, id])),
  needsReview: z.boolean(),
});
export type Sound = z.infer<typeof soundSchema>;

export const mapStopSchema = z.object({
  id,
  order: z.number().int(),
  namePt: z.string(),
  weeks: z.tuple([z.number().int(), z.number().int()]),
  stagePl: z.string(),
  x: z.number(),
  y: z.number(),
  factPl: z.string(),
  /** Ciekawostka po portugalsku — tylko z poznanym słownictwem; pojawia się po ukończeniu etapu. */
  factPtItemId: id.optional(),
});
export type MapStop = z.infer<typeof mapStopSchema>;

export const curriculumWeekSchema = z.object({
  week: z.number().int().min(1).max(26),
  month: z.number().int().min(1).max(6),
  titlePl: z.string(),
  targetLevel: z.string(),
  goals: z.array(z.string()).min(1),
  grammar: z.array(z.string()),
  topics: z.array(z.string()),
  dependsOnWeeks: z.array(z.number().int()),
  mapStopId: id,
  contentStatus: z.enum(['planned', 'draft', 'review', 'published']),
});
export type CurriculumWeek = z.infer<typeof curriculumWeekSchema>;

export const audioManifestSchema = z.object({
  provider: z.string().nullable(),
  voice: z.string().nullable(),
  license: z.string().nullable(),
  generatedAt: z.string().nullable(),
  /** itemId → plik (ścieżka względem public/). Tylko pliki, które fizycznie istnieją. */
  files: z.record(z.string(), z.object({ normal: z.string().optional(), slow: z.string().optional(), checked: z.boolean() })),
});
export type AudioManifest = z.infer<typeof audioManifestSchema>;

export const PERSONAL_FIELDS = ['name', 'city', 'country', 'job'] as const;
