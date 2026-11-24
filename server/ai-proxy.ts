/**
 * LEVADA — serwer pośredniczący dla opcjonalnego trenera rozmów AI.
 *
 * Klucz API zostaje WYŁĄCZNIE tutaj (zmienna ANTHROPIC_API_KEY lub profil `ant auth login`), nigdy w aplikacji w przeglądarce.
 *
 *   npm run ai:proxy                     — prawdziwe wywołania Claude API
 *   AI_MOCK=1 npm run ai:proxy           — tryb testowy bez API (stałe odpowiedzi, oznaczone jako mock)
 *
 * Zmienne: PORT (8787), ALLOWED_ORIGINS (lista po przecinku; domyślnie localhost:5173/4173),
 *          LEVADA_PROXY_TOKEN (opcjonalny wspólny sekret — aplikacja wysyła go w nagłówku x-levada-token).
 *
 * Serwer nie zapisuje treści rozmów (brak logowania wypowiedzi).
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { buildSystemPrompt, LEVEL_LIMITS, SUMMARY_SCHEMA, TURN_SCHEMA, summaryOutputSchema, turnOutputSchema, tutorRequestSchema, type TutorRequest } from './tutor-protocol';

const PORT = Number(process.env.PORT ?? 8787);
const MOCK = process.env.AI_MOCK === '1';
const TOKEN = process.env.LEVADA_PROXY_TOKEN || null;
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:4173').split(',').map((s) => s.trim());
const MODEL = 'claude-opus-5-5';

const client = MOCK ? null : new Anthropic();

// --- prosty limit zapytań na IP (30 / 10 min)
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 30;
}

function send(res: ServerResponse, status: number, body: unknown, origin?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin && ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage, limit = 64_000): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new Error('payload-too-large');
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function transcript(r: TutorRequest): Anthropic.Beta.BetaMessageParam[] {
  // Rozmowa jako wiadomości: tutor = assistant, uczeń = user. Pierwsza wiadomość musi być od użytkownika.
  const msgs: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: '[Start the conversation now with your first short question.]' }];
  for (const t of r.history) msgs.push({ role: t.role === 'tutor' ? 'assistant' : 'user', content: t.text });
  return msgs;
}

async function callClaude(r: TutorRequest, mode: 'turn' | 'summary'): Promise<unknown> {
  const system: Anthropic.Beta.BetaTextBlockParam[] = buildSystemPrompt(r, mode).map((text, i, arr) =>
    i === 0 && arr.length > 1 ? { type: 'text', text, cache_control: { type: 'ephemeral' } } : { type: 'text', text },
  );
  const messages = transcript(r);
  if (mode === 'summary') messages.push({ role: 'user', content: '[The conversation has ended. Produce the summary for the learner now.]' });
  else if (messages[messages.length - 1]!.role === 'assistant') messages.push({ role: 'user', content: '[Continue.]' });

  const response = await client!.beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: mode === 'turn' ? TURN_SCHEMA : SUMMARY_SCHEMA } },
    system,
    messages,
  });
  if (response.stop_reason === 'refusal') throw Object.assign(new Error('refusal'), { status: 422 });
  if (response.stop_reason === 'max_tokens') throw Object.assign(new Error('max_tokens'), { status: 502 });
  const text = response.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  const parsed = JSON.parse(text) as unknown;
  return (mode === 'turn' ? turnOutputSchema : summaryOutputSchema).parse(parsed);
}

function mockAnswer(r: TutorRequest, mode: 'turn' | 'summary') {
  if (mode === 'summary') {
    return {
      mainErrors: r.history.some((h) => h.role === 'learner' && /me chamo/i.test(h.text))
        ? [{ learnerText: 'Me chamo…', betterPt: 'Chamo-me…', explanationPl: 'W Portugalii zaimek stoi po czasowniku.', category: 'word-order' }]
        : [],
      strengthsPl: ['Odpowiadasz pełnymi zdaniami.'],
      nextStepPl: 'Poćwicz pytania o miejsce: Onde mora?',
      mock: true,
    };
  }
  const n = r.history.filter((h) => h.role === 'learner').length;
  const script = [
    { reply: 'Olá! Como se chama?', translationPl: 'Cześć! Jak się Pan/Pani nazywa?' },
    { reply: 'Muito prazer! De onde é?', translationPl: 'Bardzo mi miło! Skąd Pan/Pani jest?' },
    { reply: 'Que bom! E onde mora?', translationPl: 'Jak miło! A gdzie Pan/Pani mieszka?' },
    { reply: 'Muito bem! Obrigada pela conversa. Até logo!', translationPl: 'Bardzo dobrze! Dziękuję za rozmowę. Do zobaczenia!' },
  ];
  const s = script[Math.min(n, script.length - 1)]!;
  return {
    ...s,
    newPhrases: n === 2 ? [{ pt: 'Que bom!', pl: 'Jak miło! / Świetnie!', notePl: 'Częsta reakcja w rozmowie.' }] : [],
    hintPl: n === 0 ? 'Odpowiedz: Chamo-me …' : null,
    finished: n >= 3,
    mock: true,
  };
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin && ORIGINS.includes(origin) ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-levada-token',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    });
    return res.end();
  }
  if (req.method === 'GET' && req.url === '/v1/health') return send(res, 200, { ok: true, mock: MOCK, model: MOCK ? null : MODEL }, origin);
  if (origin && !ORIGINS.includes(origin)) return send(res, 403, { error: 'origin-not-allowed' });
  if (TOKEN && req.headers['x-levada-token'] !== TOKEN) return send(res, 401, { error: 'bad-token' }, origin);
  const ip = req.socket.remoteAddress ?? 'unknown';
  if (rateLimited(ip)) return send(res, 429, { error: 'rate-limited' }, origin);
  const mode = req.url === '/v1/tutor/turn' ? 'turn' : req.url === '/v1/tutor/summary' ? 'summary' : null;
  if (req.method !== 'POST' || !mode) return send(res, 404, { error: 'not-found' }, origin);
  try {
    const body = tutorRequestSchema.parse(await readJson(req));
    if (mode === 'turn' && body.history.filter((h) => h.role === 'learner').length > LEVEL_LIMITS[body.level].maxLearnerTurns + 2) {
      return send(res, 400, { error: 'conversation-too-long' }, origin);
    }
    const out = MOCK ? mockAnswer(body, mode) : await callClaude(body, mode);
    return send(res, 200, out, origin);
  } catch (e) {
    if (e instanceof z.ZodError) return send(res, 400, { error: 'bad-request' }, origin);
    if (e instanceof Anthropic.RateLimitError) return send(res, 429, { error: 'upstream-rate-limited' }, origin);
    if (e instanceof Anthropic.AuthenticationError) return send(res, 500, { error: 'proxy-auth-misconfigured' }, origin);
    if (e instanceof Anthropic.APIError) return send(res, 502, { error: 'upstream-error', status: e.status }, origin);
    const err = e as Error & { status?: number };
    if (err.message === 'payload-too-large') return send(res, 413, { error: 'payload-too-large' }, origin);
    return send(res, err.status ?? 500, { error: err.message === 'refusal' ? 'refusal' : 'internal' }, origin);
  }
});

server.listen(PORT, () => {
  console.log(`Levada AI proxy: http://localhost:${PORT} ${MOCK ? '(TRYB TESTOWY — mock, bez wywołań API)' : `(model ${MODEL})`}`);
  console.log(`Dozwolone źródła: ${ORIGINS.join(', ')}${TOKEN ? ' · wymagany token' : ''}`);
});
