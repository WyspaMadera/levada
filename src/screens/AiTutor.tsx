import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Bot, Send, ShieldCheck, Volume2 } from 'lucide-react';
import { db } from '@/db/db';
import { logStudy, recordResult, saveConversation } from '@/db/repo';
import { buildContext, LEVEL_LIMITS, TutorError, tutorSummary, tutorTurn, type TutorHistory, type TutorSummary, type TutorTurn } from '@/lib/aiTutor';
import { speakText, stopAll } from '@/lib/audio';
import { recognizeOnce, speechRecognitionSupported } from '@/lib/recorder';
import { useApp } from '@/state/AppContext';
import { Badge, Button, Card, Notice, PageHeader, cx } from '@/components/ui';
import { CATEGORY_PL } from './Mistakes';
import type { MistakeCategory } from '@/content/schema';

const TOPICS = ['przedstawianie się', 'rodzina', 'mój dzień', 'pogoda', 'kawiarnia i zakupy', 'plany na weekend', 'Madera', 'praca', 'zainteresowania'];

type Msg = { role: 'tutor' | 'learner'; text: string; turn?: TutorTurn };

export default function AiTutor() {
  const { settings, update, audio } = useApp();
  const [topic, setTopic] = useState(TOPICS[0]!);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<TutorSummary | null>(null);
  const [level, setLevel] = useState<keyof typeof LEVEL_LIMITS>('A0');
  const started = useRef(Date.now());
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, summary]);
  useEffect(() => () => stopAll(), []);

  if (!settings.aiEndpoint) {
    return (
      <div className="space-y-4">
        <PageHeader title="Trener rozmów AI" back="/rozmowy" />
        <Notice tone="info" title="Opcjonalna funkcja — wymaga konfiguracji">
          <p>
            Trener AI łączy się z <strong>Twoim własnym serwerem pośredniczącym</strong>, który przechowuje klucz API (klucze nigdy nie trafiają do aplikacji w przeglądarce).
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Uruchom serwer z repozytorium: <code>npm run ai:proxy</code> (klucz w zmiennej <code>ANTHROPIC_API_KEY</code>).</li>
            <li>W Ustawieniach → „Trener AI” wpisz adres serwera i wyraź zgodę.</li>
          </ol>
          <p className="mt-2">Do testów bez kosztów: <code>npm run ai:proxy:mock</code> (stałe odpowiedzi, oznaczone jako tryb testowy).</p>
        </Notice>
        <Link to="/ustawienia#ai" className="block">
          <Button className="w-full">Przejdź do ustawień</Button>
        </Link>
        <Link to="/rozmowy" className="block text-center text-sm underline">
          Rozmowy bez AI działają już teraz
        </Link>
      </div>
    );
  }

  if (!settings.aiConsent) {
    return (
      <div className="space-y-4">
        <PageHeader title="Trener rozmów AI" back="/rozmowy" />
        <Card className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-5" /> Zanim zaczniesz
          </p>
          <ul className="list-inside list-disc space-y-1">
            <li>Twoje wypowiedzi (tekst) będą wysyłane do serwera: <code className="break-all">{settings.aiEndpoint}</code>, a stamtąd do usługi AI.</li>
            <li>Wysyłamy też listę poznanych słów i umiejętności, żeby AI nie używało materiału, którego nie znasz.</li>
            <li>Dane z życiorysu wysyłamy tylko, jeśli to osobno włączysz. Nagrań głosu nie wysyłamy.</li>
            <li>Odpowiedzi AI nie są weryfikowane przez człowieka — mogą zawierać błędy. AI nie podaje zapisu wymowy.</li>
          </ul>
        </Card>
        <Button className="w-full" size="lg" onClick={() => update({ aiConsent: true })}>
          Rozumiem i zgadzam się
        </Button>
      </div>
    );
  }

  const history: TutorHistory = (msgs ?? []).map((m) => ({ role: m.role, text: m.text }));
  const learnerTurns = history.filter((h) => h.role === 'learner').length;
  const finished = Boolean(msgs?.some((m) => m.turn?.finished));
  const limit = LEVEL_LIMITS[level].maxLearnerTurns;

  const speak = (t: string) => {
    if (audio?.choice.voice) void speakText(t, audio.choice.voice, settings.playbackRate);
  };

  const request = async (hist: TutorHistory) => {
    setBusy(true);
    setError(null);
    try {
      const ctx = await buildContext(settings, topic);
      setLevel(ctx.level);
      const turn = await tutorTurn(settings, { ...ctx, history: hist });
      setMsgs((m) => [...(m ?? []), { role: 'tutor', text: turn.reply, turn }]);
      if (settings.autoPlayAudio) speak(turn.reply);
    } catch (e) {
      setError(e instanceof TutorError ? e.message : 'Nieoczekiwany błąd.');
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    started.current = Date.now();
    setSummary(null);
    setMsgs([]);
    await request([]);
  };

  const sendLearner = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const next: Msg[] = [...(msgs ?? []), { role: 'learner', text }];
    setMsgs(next);
    await request(next.map((m) => ({ role: m.role, text: m.text })));
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    try {
      const ctx = await buildContext(settings, topic);
      const s = await tutorSummary(settings, { ...ctx, history });
      setSummary(s);
      const seconds = (Date.now() - started.current) / 1000;
      await saveConversation({
        kind: 'ai',
        refId: topic,
        level: ctx.level,
        turns: history.map((h) => ({ speaker: h.role === 'tutor' ? 'other' : 'learner', text: h.text })),
        seconds,
        speakingSeconds: 0,
        aiSummary: s,
      });
      await logStudy('conversation', seconds);
      // najważniejsze błędy trafiają do zeszytu (z oznaczeniem, że to ocena AI)
      for (const er of s.mainErrors.slice(0, 3)) {
        await db.mistakes.add({
          at: new Date().toISOString(),
          category: er.category as MistakeCategory,
          expected: er.betterPt,
          given: er.learnerText,
          notePl: `[AI, niezweryfikowane] ${er.explanationPl}`,
          resolved: 0,
          correctStreak: 0,
        });
      }
      // rozmowa liczy się jako próba samodzielnego mówienia/budowania zdań w radarze
      await recordResult({ skill: 'building', correct: s.mainErrors.length === 0, context: 'review', exerciseId: `ai-${Date.now()}`, schedule: false });
    } catch (e) {
      setError(e instanceof TutorError ? e.message : 'Nie udało się przygotować podsumowania.');
    } finally {
      setBusy(false);
    }
  };

  const dictate = async () => {
    try {
      const alts = await recognizeOnce('pt-PT').promise;
      if (alts[0]) setInput((v) => (v ? `${v} ` : '') + alts[0]);
    } catch {
      setError('Dyktowanie nie zadziałało (brak obsługi, zgody na mikrofon lub internetu).');
    }
  };

  return (
    <div className="space-y-4" data-testid="ai-tutor">
      <PageHeader title="Trener rozmów AI" subtitle={`Poziom ${level} · ${LEVEL_LIMITS[level].labelPl}`} back="/rozmowy" right={<Badge tone="warn">AI — niezweryfikowane</Badge>} />
      {msgs === null ? (
        <Card className="space-y-3">
          <p className="font-semibold">Temat rozmowy</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Temat rozmowy">
            {TOPICS.map((t) => (
              <button
                key={t}
                role="radio"
                aria-checked={topic === t}
                onClick={() => setTopic(t)}
                className={cx('focus-ring rounded-full border px-3 py-1.5 text-sm', topic === t ? 'border-atlantic-600 bg-atlantic-600 text-white' : 'border-[var(--border)]')}
              >
                {t}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--muted)]">
            AI używa tylko materiału z ukończonych lekcji i nie poprawia każdego drobiazgu w trakcie — najważniejsze błędy pokaże w podsumowaniu.
            {settings.aiShareProfile ? ' Dane z życiorysu: włączone.' : ' Dane z życiorysu: nie są wysyłane.'}
          </p>
          <Button className="w-full" size="lg" onClick={start} disabled={busy}>
            <Bot className="size-5" /> Zacznij rozmowę
          </Button>
        </Card>
      ) : (
        <div className="space-y-3" aria-live="polite">
          {msgs.map((m, idx) => (
            <div key={idx} className={cx('flex', m.role === 'learner' && 'justify-end')}>
              <div className={cx('max-w-[88%] rounded-2xl border p-3', m.role === 'learner' ? 'border-atlantic-500/40 bg-atlantic-100/60 dark:bg-atlantic-700/25' : 'border-[var(--border)] bg-[var(--surface)]')}>
                <div className="flex items-start gap-2">
                  {m.role === 'tutor' && audio?.choice.voice && (
                    <button type="button" aria-label="Odsłuchaj" className="focus-ring mt-0.5 rounded-full p-1 text-atlantic-600" onClick={() => speak(m.text)}>
                      <Volume2 className="size-4" />
                    </button>
                  )}
                  <div className="min-w-0">
                    <p lang="pt-PT" className="font-medium">
                      {m.text}
                    </p>
                    {m.turn && (
                      <details className="mt-1 text-sm text-[var(--muted)]">
                        <summary className="cursor-pointer">tłumaczenie{m.turn.newPhrases.length ? ' i nowe słowa' : ''}</summary>
                        <p>{m.turn.translationPl}</p>
                        {m.turn.newPhrases.map((p) => (
                          <p key={p.pt}>
                            <strong lang="pt-PT">{p.pt}</strong> — {p.pl}
                            {p.notePl ? ` (${p.notePl})` : ''}
                          </p>
                        ))}
                      </details>
                    )}
                    {m.turn?.hintPl && <p className="mt-1 text-xs text-atlantic-700 dark:text-atlantic-100">Podpowiedź: {m.turn.hintPl}</p>}
                    {m.turn?.mock && <Badge className="mt-1">tryb testowy (mock)</Badge>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {busy && <p className="text-sm text-[var(--muted)]">AI pisze…</p>}
          {error && <Notice tone="warn">{error}</Notice>}
          {!summary && !finished && learnerTurns < limit + 2 && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void sendLearner();
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                lang="pt-PT"
                placeholder="Odpowiedz po portugalsku…"
                aria-label="Twoja odpowiedź"
                className="focus-ring min-w-0 flex-1 rounded-xl border-2 border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                disabled={busy}
              />
              {speechRecognitionSupported() && (
                <Button type="button" variant="secondary" onClick={dictate} aria-label="Dyktuj" disabled={busy}>
                  🎤
                </Button>
              )}
              <Button type="submit" disabled={busy || !input.trim()} aria-label="Wyślij">
                <Send className="size-4" />
              </Button>
            </form>
          )}
          {!summary && learnerTurns > 0 && (
            <Button variant={finished || learnerTurns >= limit ? 'primary' : 'secondary'} className="w-full" onClick={finish} disabled={busy}>
              Zakończ i pokaż podsumowanie
            </Button>
          )}
          {summary && (
            <Card className="space-y-2" data-testid="ai-summary">
              <p className="font-bold">Podsumowanie (AI — niezweryfikowane)</p>
              {summary.mainErrors.length === 0 ? (
                <p className="text-sm">Bez istotnych błędów.</p>
              ) : (
                summary.mainErrors.map((er, k) => (
                  <div key={k} className="text-sm">
                    <p>
                      <span className="text-[var(--muted)]">Ty:</span> {er.learnerText} → <strong lang="pt-PT">{er.betterPt}</strong>
                    </p>
                    <p className="text-[var(--muted)]">
                      {CATEGORY_PL[er.category as MistakeCategory] ?? er.category}: {er.explanationPl}
                    </p>
                  </div>
                ))
              )}
              {summary.strengthsPl.length > 0 && <p className="text-sm">Dobrze: {summary.strengthsPl.join(' · ')}</p>}
              <p className="text-sm">Następny krok: {summary.nextStepPl}</p>
              <p className="text-xs text-[var(--muted)]">Błędy dodano do zeszytu błędów z oznaczeniem „AI, niezweryfikowane”.</p>
              <Button variant="secondary" className="w-full" onClick={() => setMsgs(null)}>
                Nowa rozmowa
              </Button>
            </Card>
          )}
          <div ref={bottom} />
        </div>
      )}
    </div>
  );
}
