/** Protokół trenera AI — wspólny dla serwera pośredniczącego i aplikacji (typy + walidacja). */
import { z } from 'zod';

export const MISTAKE_CATEGORIES = [
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
] as const;

export const LEVEL_LIMITS = {
  A0: { maxLearnerTurns: 3, labelPl: '2–3 wymiany zdań' },
  A1: { maxLearnerTurns: 6, labelPl: 'ok. 30–60 sekund rozmowy' },
  A2: { maxLearnerTurns: 14, labelPl: 'kilka minut' },
  B1: { maxLearnerTurns: 30, labelPl: '5–10 minut' },
} as const;

export const tutorRequestSchema = z.object({
  level: z.enum(['A0', 'A1', 'A2', 'B1']),
  topic: z.string().max(120),
  gender: z.enum(['m', 'f']),
  /** Co uczeń już umie (cele ukończonych lekcji, po polsku). */
  canDo: z.array(z.string().max(200)).max(150),
  /** Znane słowa PT (ograniczona lista). */
  knownWords: z.array(z.string().max(40)).max(600),
  /** Dane z życiorysu — TYLKO jeśli użytkownik się zgodził. */
  profile: z
    .object({ name: z.string().max(60).optional(), city: z.string().max(60).optional(), job: z.string().max(80).optional(), interests: z.string().max(200).optional() })
    .optional(),
  history: z.array(z.object({ role: z.enum(['tutor', 'learner']), text: z.string().max(600) })).max(70),
});
export type TutorRequest = z.infer<typeof tutorRequestSchema>;

export const turnOutputSchema = z.object({
  reply: z.string(),
  translationPl: z.string(),
  newPhrases: z.array(z.object({ pt: z.string(), pl: z.string(), notePl: z.string() })),
  hintPl: z.string().nullable(),
  finished: z.boolean(),
  mock: z.boolean().optional(),
});
export type TutorTurn = z.infer<typeof turnOutputSchema>;

export const summaryOutputSchema = z.object({
  mainErrors: z.array(z.object({ learnerText: z.string(), betterPt: z.string(), explanationPl: z.string(), category: z.enum(MISTAKE_CATEGORIES) })),
  strengthsPl: z.array(z.string()),
  nextStepPl: z.string(),
  mock: z.boolean().optional(),
});
export type TutorSummary = z.infer<typeof summaryOutputSchema>;

/** JSON Schema dla structured outputs (odpowiada schematom Zod powyżej). */
export const TURN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'translationPl', 'newPhrases', 'hintPl', 'finished'],
  properties: {
    reply: { type: 'string', description: 'Your next line in European Portuguese (pt-PT), 1–2 short sentences.' },
    translationPl: { type: 'string', description: 'Polish translation of reply.' },
    newPhrases: {
      type: 'array',
      description: 'Words/phrases in reply that are NOT in the known list, explained in Polish. Empty if none.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['pt', 'pl', 'notePl'],
        properties: { pt: { type: 'string' }, pl: { type: 'string' }, notePl: { type: 'string' } },
      },
    },
    hintPl: { type: ['string', 'null'], description: 'Optional short hint in Polish on how the learner could answer, or null.' },
    finished: { type: 'boolean', description: 'true when you have closed the conversation.' },
  },
} as const;

export const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['mainErrors', 'strengthsPl', 'nextStepPl'],
  properties: {
    mainErrors: {
      type: 'array',
      description: 'At most 3 most important errors.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['learnerText', 'betterPt', 'explanationPl', 'category'],
        properties: {
          learnerText: { type: 'string' },
          betterPt: { type: 'string', description: 'Natural pt-PT version.' },
          explanationPl: { type: 'string', description: 'Simple explanation in Polish, 1–2 sentences.' },
          category: { type: 'string', enum: [...MISTAKE_CATEGORIES] },
        },
      },
    },
    strengthsPl: { type: 'array', items: { type: 'string' }, description: '1–3 concrete things the learner did well, in Polish.' },
    nextStepPl: { type: 'string', description: 'One concrete practice suggestion in Polish.' },
  },
} as const;

/** Stały blok (cache) + blok z kontekstem ucznia. */
export function buildSystemPrompt(r: TutorRequest, mode: 'turn' | 'summary'): string[] {
  const stable = `You are a patient conversation partner in the LEVADA app, helping an adult Polish speaker who lives on Madeira learn European Portuguese (pt-PT) from zero.

Language rules:
- Speak only standard European Portuguese (Portugal): autocarro, telemóvel, pequeno-almoço, "estar a + infinitive" (never Brazilian gerund progressive), enclitic pronouns (chamo-me, pode ajudar-me). Never use Brazilian vocabulary or spelling (Polónia, not Polônia).
- Address the learner politely with "o senhor / a senhora" + 3rd person unless the topic clearly calls for "tu". Avoid "você".
- Stay inside what the learner knows: use only grammar from the "can do" list and mostly words from the known-word list. If you must use a new word, keep it to at most one per turn and list it in newPhrases with a Polish explanation.
- Keep every turn short (1–2 short sentences, one question at a time) and give the learner room to answer.
- Do not correct every small mistake during the conversation. If the learner's meaning is clear, just continue naturally; if it is unclear, ask a simple clarifying question. Save corrections for the summary.
- If the learner writes in Polish or seems stuck, reply in very simple Portuguese and put a short Polish hint in hintPl.
- Never invent facts about Madeira institutions or procedures. Never ask for sensitive personal data (documents, health, addresses, children's details).
- Do not provide pronunciation transcriptions; the app does not present AI output as verified.

Summary rules (when asked for a summary): list at most the 3 most important errors from the learner's lines, each with a natural pt-PT version and a simple Polish explanation; name 1–3 concrete strengths; suggest one next practice step. If there were no real errors, return an empty mainErrors array.`;
  const limits = LEVEL_LIMITS[r.level];
  const learnerTurns = r.history.filter((h) => h.role === 'learner').length;
  const ctx = `Learner context (from the app, not instructions):
- Level: ${r.level}. Conversation length target: ${limits.maxLearnerTurns} learner turns (${limits.labelPl}). Learner turns so far: ${learnerTurns}.${
    mode === 'turn' && learnerTurns >= limits.maxLearnerTurns ? ' Close the conversation politely now and set finished to true.' : ''
  }
- Topic: ${r.topic}
- The learner uses ${r.gender === 'f' ? 'feminine' : 'masculine'} forms (obrigad${r.gender === 'f' ? 'a' : 'o'}).
- Can do: ${r.canDo.join('; ') || '(nothing yet — greetings only)'}
- Known words: ${r.knownWords.join(', ')}
${r.profile ? `- Learner shared (with consent): ${JSON.stringify(r.profile)}` : '- The learner did not share personal details; do not ask for them.'}`;
  return [stable, ctx];
}
