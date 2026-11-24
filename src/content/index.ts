import { z } from 'zod';
import {
  audioManifestSchema,
  conversationScenarioSchema,
  readingSchema,
  cheatsheetSchema,
  librarySourceSchema,
  biographySectionSchema,
  missionSchema,
  competenceAreaSchema,
  type CompetenceArea,
  type Reading,
  type Cheatsheet,
  type LibrarySource,
  type BiographySection,
  type Mission,
  openQuestionSchema,
  curriculumWeekSchema,
  dialogueSchema,
  exerciseSchema,
  learningItemSchema,
  lessonSchema,
  mapStopSchema,
  soundSchema,
  speakingTaskSchema,
  testSchema,
  type AudioManifest,
  type ConversationScenario,
  type OpenQuestion,
  type CurriculumWeek,
  type Dialogue,
  type Exercise,
  type LearningItem,
  type Lesson,
  type MapStop,
  type Sound,
  type SpeakingTask,
  type Test,
} from './schema';

/** Surowe pliki treści: ścieżka → zawartość JSON. */
export type RawContent = Record<string, unknown>;

export type ContentIndex = {
  items: Map<string, LearningItem>;
  lessons: Lesson[];
  lessonById: Map<string, Lesson>;
  dialogues: Map<string, Dialogue>;
  exercises: Map<string, Exercise>;
  speaking: Map<string, SpeakingTask>;
  tests: Map<string, Test>;
  sounds: Sound[];
  soundById: Map<string, Sound>;
  stops: MapStop[];
  weeks: CurriculumWeek[];
  audio: AudioManifest;
  scenarios: ConversationScenario[];
  questions: OpenQuestion[];
  readings: Reading[];
  cheatsheets: Cheatsheet[];
  library: LibrarySource[];
  biography: BiographySection[];
  missions: Mission[];
  competences: CompetenceArea[];
  /** Plik źródłowy dla każdego ID (do raportów). */
  sourceOf: Map<string, string>;
};

export type LoadProblem = { file: string; message: string };

const COLLECTIONS = {
  items: z.array(learningItemSchema),
  lessons: z.array(lessonSchema),
  dialogues: z.array(dialogueSchema),
  exercises: z.array(exerciseSchema),
  speaking: z.array(speakingTaskSchema),
  tests: z.array(testSchema),
  sounds: z.array(soundSchema),
  map: z.array(mapStopSchema),
  curriculum: z.array(curriculumWeekSchema),
  conversations: z.array(conversationScenarioSchema),
  questions: z.array(openQuestionSchema),
  readings: z.array(readingSchema),
  cheatsheets: z.array(cheatsheetSchema),
  library: z.array(librarySourceSchema),
  biography: z.array(biographySectionSchema),
  missions: z.array(missionSchema),
  competences: z.array(competenceAreaSchema),
} as const;

type CollectionKey = keyof typeof COLLECTIONS;

function collectionOf(path: string): CollectionKey | 'audio' | null {
  const m = path.match(/content\/([a-z]+)\//);
  if (!m) return null;
  const dir = m[1]!;
  if (dir === 'audio') return 'audio';
  return (dir in COLLECTIONS ? dir : null) as CollectionKey | null;
}

export function buildIndex(raw: RawContent): { index: ContentIndex; problems: LoadProblem[] } {
  const problems: LoadProblem[] = [];
  const index: ContentIndex = {
    items: new Map(),
    lessons: [],
    lessonById: new Map(),
    dialogues: new Map(),
    exercises: new Map(),
    speaking: new Map(),
    tests: new Map(),
    sounds: [],
    soundById: new Map(),
    stops: [],
    weeks: [],
    audio: { provider: null, voice: null, license: null, generatedAt: null, files: {} },
    scenarios: [],
    questions: [],
    readings: [],
    cheatsheets: [],
    library: [],
    biography: [],
    missions: [],
    competences: [],
    sourceOf: new Map(),
  };

  const register = <T extends { id: string }>(map: Map<string, T>, kind: string, file: string, v: T) => {
    if (map.has(v.id)) problems.push({ file, message: `Zduplikowane ID (${kind}): ${v.id} (także w ${index.sourceOf.get(`${kind}:${v.id}`)})` });
    map.set(v.id, v);
    index.sourceOf.set(`${kind}:${v.id}`, file);
  };

  for (const file of Object.keys(raw).sort()) {
    const coll = collectionOf(file);
    if (!coll) continue;
    const data = raw[file];
    if (coll === 'audio') {
      const r = audioManifestSchema.safeParse(data);
      if (r.success) index.audio = r.data;
      else problems.push({ file, message: z.prettifyError(r.error) });
      continue;
    }
    const r = COLLECTIONS[coll].safeParse(data);
    if (!r.success) {
      problems.push({ file, message: z.prettifyError(r.error) });
      continue;
    }
    switch (coll) {
      case 'items':
        for (const v of r.data as LearningItem[]) register(index.items, 'item', file, v);
        break;
      case 'lessons':
        for (const v of r.data as Lesson[]) {
          register(index.lessonById, 'lesson', file, v);
          index.lessons.push(v);
        }
        break;
      case 'dialogues':
        for (const v of r.data as Dialogue[]) register(index.dialogues, 'dialogue', file, v);
        break;
      case 'exercises':
        for (const v of r.data as Exercise[]) register(index.exercises, 'exercise', file, v);
        break;
      case 'speaking':
        for (const v of r.data as SpeakingTask[]) register(index.speaking, 'speaking', file, v);
        break;
      case 'tests':
        for (const v of r.data as Test[]) register(index.tests, 'test', file, v);
        break;
      case 'sounds':
        for (const v of r.data as Sound[]) {
          register(index.soundById, 'sound', file, v);
          index.sounds.push(v);
        }
        break;
      case 'map':
        index.stops.push(...(r.data as MapStop[]));
        break;
      case 'curriculum':
        index.weeks.push(...(r.data as CurriculumWeek[]));
        break;
      case 'conversations':
        index.scenarios.push(...(r.data as ConversationScenario[]));
        break;
      case 'questions':
        index.questions.push(...(r.data as OpenQuestion[]));
        break;
      case 'readings':
        index.readings.push(...(r.data as Reading[]));
        break;
      case 'cheatsheets':
        index.cheatsheets.push(...(r.data as Cheatsheet[]));
        break;
      case 'library':
        index.library.push(...(r.data as LibrarySource[]));
        break;
      case 'biography':
        index.biography.push(...(r.data as BiographySection[]));
        break;
      case 'missions':
        index.missions.push(...(r.data as Mission[]));
        break;
      case 'competences':
        index.competences.push(...(r.data as CompetenceArea[]));
        break;
    }
  }
  index.lessons.sort((a, b) => a.week - b.week || a.day - b.day);
  index.sounds.sort((a, b) => a.order - b.order);
  index.stops.sort((a, b) => a.order - b.order);
  index.weeks.sort((a, b) => a.week - b.week);
  index.cheatsheets.sort((a, b) => a.order - b.order);
  index.biography.sort((a, b) => a.order - b.order);
  index.competences.sort((a, b) => a.order - b.order);
  return { index, problems };
}

/** Wszystkie ID elementów, do których odwołuje się lekcja (nowe, przykłady, dialogi, ćwiczenia, mówienie). */
export function lessonItemIds(idx: ContentIndex, lesson: Lesson): string[] {
  const ids = new Set<string>([...lesson.newItemIds, ...lesson.warmup.itemIds, ...(lesson.grammar?.exampleIds ?? [])]);
  for (const d of lesson.dialogueIds) idx.dialogues.get(d)?.lines.forEach((l) => ids.add(l.itemId));
  for (const s of lesson.speakingTaskIds) idx.speaking.get(s)?.modelItemIds.forEach((m) => ids.add(m));
  return [...ids];
}

/** Elementy, które po lekcji trafiają do powtórek (nowe słowa + przykłady + kwestie dialogu). */
export function lessonStudyItemIds(idx: ContentIndex, lesson: Lesson): string[] {
  const ids = new Set<string>([...lesson.newItemIds, ...(lesson.grammar?.exampleIds ?? [])]);
  for (const d of lesson.dialogueIds) idx.dialogues.get(d)?.lines.forEach((l) => ids.add(l.itemId));
  return [...ids].filter((id) => idx.items.has(id));
}

export function visibleLessons(idx: ContentIndex): Lesson[] {
  return idx.lessons.filter((l) => l.status !== 'draft');
}
