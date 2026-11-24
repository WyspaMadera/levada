import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { CalendarClock, ChevronRight, ListMusic, Pause, Play, Radio, SkipBack, SkipForward, Square } from 'lucide-react';
import { State } from 'ts-fsrs';
import { content } from '@/content/content';
import { lessonStudyItemIds } from '@/content/index';
import { db, type PlaybackRate } from '@/db/db';
import { logStudy } from '@/db/repo';
import { playItem, speakText, stopAll } from '@/lib/audio';
import {
  blockStarts,
  buildAutoSteps,
  DEFAULT_AUTO,
  estimateSeconds,
  itemsForMinutes,
  loadPlaylist,
  loadProgress,
  savePlaylist,
  saveProgress,
  type AutoStep,
  type PolishPrompts,
} from '@/lib/autoSession';
import { todayKey } from '@/lib/planner';
import { getItem, itemView } from '@/lib/items';
import { useApp } from '@/state/AppContext';
import { useCourse } from '@/state/course';
import { Button, Card, Notice, PageHeader, cx } from '@/components/ui';

type Kind = 'day' | 'lesson' | 'dialogues' | 'hardest' | 'saved';
const KINDS: { v: Exclude<Kind, 'saved'>; label: string; desc: string }[] = [
  { v: 'day', label: 'Powtórka dnia', desc: 'Elementy, które czekają na powtórkę' },
  { v: 'lesson', label: 'Lekcja na słuch', desc: 'Słowa, przykłady i dialog wybranej lekcji' },
  { v: 'dialogues', label: 'Dialogi tygodnia', desc: 'Kwestie dialogów z bieżącego tygodnia' },
  { v: 'hardest', label: 'Najtrudniejsze zwroty', desc: 'Z zeszytu błędów i z największą liczbą pomyłek' },
];
const PROMPTS: [PolishPrompts, string][] = [
  ['full', 'zawsze'],
  ['auto', 'tylko trudne'],
  ['reduced', 'co drugi'],
  ['none', 'bez'],
];

const sleep = (ms: number, token: { cancelled: boolean }) =>
  new Promise<void>((res) => {
    const t0 = Date.now();
    const tick = () => (token.cancelled || Date.now() - t0 >= ms ? res() : setTimeout(tick, 100));
    tick();
  });

export default function Listen() {
  const { audio, settings, update } = useApp();
  const course = useCourse();
  const saved = useMemo(() => loadPlaylist(), []);
  const savedForToday = saved && saved.date <= todayKey() ? saved : null;
  const [kind, setKind] = useState<Kind>(savedForToday ? 'saved' : 'day');
  const [minutes, setMinutes] = useState(savedForToday?.minutes ?? 5);
  const [prompts, setPrompts] = useState<PolishPrompts>(savedForToday?.prompts ?? 'full');
  const [backchain, setBackchain] = useState(true);
  const lastDone = [...course.lessons].reverse().find((l) => course.completedIds.has(l.id));
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const token = useRef({ cancelled: false });
  const started = useRef<number | null>(null);

  const data = useLiveQuery(async () => ({ cards: await db.cards.toArray(), mistakes: await db.mistakes.where('resolved').equals(0).toArray() }), []);
  const opts = { ...DEFAULT_AUTO, polishPrompts: prompts, backchain };

  const items = useMemo(() => {
    if (!data) return [];
    const max = itemsForMinutes(minutes, opts);
    let ids: string[];
    if (kind === 'saved' && savedForToday) ids = savedForToday.itemIds;
    else if (kind === 'day') {
      ids = [...data.cards].sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime()).map((c) => c.itemId);
    } else if (kind === 'lesson') {
      const l = content.lessonById.get(lessonId ?? lastDone?.id ?? '');
      ids = l ? lessonStudyItemIds(content, l) : [];
    } else if (kind === 'dialogues') {
      ids = course.lessons
        .filter((l) => l.week === course.currentWeek && course.completedIds.has(l.id))
        .flatMap((l) => l.dialogueIds.flatMap((d) => content.dialogues.get(d)?.lines.map((x) => x.itemId) ?? []));
    } else {
      const counts = new Map<string, number>();
      for (const m of data.mistakes) if (m.itemId) counts.set(m.itemId, (counts.get(m.itemId) ?? 0) + 1);
      for (const c of data.cards) if (c.lapses) counts.set(c.itemId, (counts.get(c.itemId) ?? 0) + c.lapses);
      ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    }
    return [...new Set(ids)].filter((id) => content.items.has(id)).slice(0, max);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kind, minutes, prompts, backchain, lessonId, course.completedIds.size]);

  const steps: AutoStep[] = useMemo(() => {
    const recallWell = new Set((data?.cards ?? []).filter((c) => c.skill === 'recall' && c.state === State.Review && c.reps - c.lapses >= 3).map((c) => c.itemId));
    return buildAutoSteps(
      items.map((id) => {
        const v = itemView(getItem(id), settings.gender);
        return { id, pl: v.pl, pt: v.pt, fem: v.fem, knownWell: recallWell.has(id) };
      }),
      opts,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, prompts, backchain, settings.gender, data]);
  const blocks = useMemo(() => blockStarts(steps), [steps]);
  const sessionKey = `${kind}|${lessonId ?? ''}|${minutes}|${prompts}|${backchain}|${items.join(',')}`;

  // wznowienie: zapamiętana pozycja dla tej samej sesji
  useEffect(() => {
    if (!playing) setPos(loadProgress(sessionKey));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionKey]);

  const canPlay = Boolean(audio?.choice.voice) || Object.keys(content.audio.files).length > 0;
  const currentBlock = Math.max(0, blocks.filter((b) => b <= pos).length - 1);

  const stopPlayback = () => {
    token.current.cancelled = true;
    stopAll();
    setPlaying(false);
    if (started.current) {
      void logStudy('listening', (Date.now() - started.current) / 1000);
      started.current = null;
    }
  };

  const run = async (from: number) => {
    if (!audio) return;
    const tk = { cancelled: false };
    token.current = tk;
    setPlaying(true);
    started.current ??= Date.now();
    for (let i = from; i < steps.length; i++) {
      if (tk.cancelled) return;
      setPos(i);
      saveProgress(sessionKey, i);
      const s = steps[i]!;
      if (s.kind === 'pause') {
        setLabel(s.labelPl);
        await sleep(s.ms, tk);
      } else if (s.kind === 'pl') {
        setLabel(`PL: ${s.text}`);
        const ok = await speakText(s.text, audio.polish, 1);
        if (!ok) await sleep(1800, tk);
      } else if (s.kind === 'pt-text') {
        setLabel(`PT: … ${s.text}`);
        if (audio.choice.voice) await speakText(s.text, audio.choice.voice, Math.min(settings.playbackRate, 1));
      } else {
        const it = getItem(s.itemId);
        setLabel(`PT: ${itemView(it, settings.gender, s.fem).pt}`);
        await playItem(it, audio.choice, { rate: settings.playbackRate, fem: s.fem, repeat: 1 });
      }
    }
    if (!tk.cancelled) {
      setLabel('Koniec sesji');
      saveProgress(sessionKey, 0);
      stopPlayback();
      setPos(0);
    }
  };

  const jump = (target: number | undefined) => {
    if (target === undefined) return;
    const was = playing;
    stopPlayback();
    setPos(target);
    saveProgress(sessionKey, target);
    if (was) setTimeout(() => void run(target), 120);
  };
  const nextBlock = () => jump(blocks.find((b) => b > pos));
  const prevBlock = () => jump([...blocks].reverse().find((b) => b < blocks[currentBlock]!) ?? 0);

  // Media Session — przyciski na ekranie blokady / w samochodzie (gdzie obsługiwane)
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: kind === 'saved' ? (savedForToday?.titlePl ?? 'Playlista') : (KINDS.find((k) => k.v === kind)?.label ?? 'Levada'),
      artist: 'Levada — portugalski europejski',
      album: 'Tryb Auto',
    });
    navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', () => void run(pos)],
      ['pause', stopPlayback],
      ['stop', stopPlayback],
      ['nexttrack', nextBlock],
      ['previoustrack', prevBlock],
    ];
    for (const [a, h] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(a, h);
      } catch {
        /* akcja nieobsługiwana w tej przeglądarce */
      }
    }
    return () => {
      for (const [a] of handlers) {
        try {
          navigator.mediaSession.setActionHandler(a, null);
        } catch {
          /* pomijamy */
        }
      }
    };
  });
  useEffect(() => () => stopPlayback(), []);

  const prepareTomorrow = async () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    // na jutro: karty, które będą do powtórki jutro + najtrudniejsze
    const cards = await db.cards.toArray();
    const due = [
      ...new Set(
        cards
          .filter((c) => new Date(c.due).getTime() <= tomorrow.getTime() + 12 * 3_600_000)
          .sort((a, b) => b.lapses - a.lapses || new Date(a.due).getTime() - new Date(b.due).getTime())
          .map((c) => c.itemId),
      ),
    ]
      .filter((id) => content.items.has(id))
      .slice(0, itemsForMinutes(minutes, opts));
    // gdy nic nie czeka na powtórkę — zapisujemy bieżący wybór sesji
    const ids = due.length ? due : items;
    if (ids.length === 0) return setNote('Brak materiału na jutro — ukończ lekcję, a playlista się zapełni.');
    savePlaylist({ date: todayKey(tomorrow), kind: 'day', titlePl: `Playlista na ${tomorrow.toLocaleDateString('pl-PL', { weekday: 'long' })}`, minutes, prompts, itemIds: ids });
    // nagrania (jeśli istnieją) pobieramy teraz do pamięci podręcznej — działają potem offline
    const files = ids.flatMap((id) => [content.audio.files[id]?.normal, content.audio.files[id]?.slow]).filter((f): f is string => Boolean(f));
    await Promise.allSettled(files.map((f) => fetch(`./${f}`)));
    setNote(
      `Zapisano playlistę na jutro: ${ids.length} elementów, ok. ${minutes} min.` +
        (files.length ? ` Pobrano ${files.length} nagrań do pamięci offline.` : ' Odtwarzanie użyje głosu urządzenia (bez nagrań — głosy sieciowe wymagają internetu).'),
    );
  };

  const current = steps[pos];
  const queue = blocks
    .slice(currentBlock, currentBlock + 6)
    .map((b) => steps[b]!)
    .filter((s): s is Exclude<AutoStep, { kind: 'pause' }> => s.kind !== 'pause');

  return (
    <div className="space-y-4" data-testid="listen">
      <PageHeader title="Słuchanie — Tryb Auto" subtitle="Nauka bez patrzenia na ekran. Playlistę wybierz przed jazdą." />
      <Link to="/sluchaj" className="block">
        <Card className="flex items-center gap-3 py-3">
          <Radio className="size-5 text-atlantic-600" />
          <span className="flex-1 text-sm font-medium">Słuchaj portugalskiego — podcasty, YouTube, radio</span>
          <ChevronRight className="size-4 text-[var(--muted)]" />
        </Card>
      </Link>
      <Notice tone="warn" title="Bezpieczeństwo i ograniczenia">
        <p>Podczas prowadzenia nie dotykaj telefonu — wszystko ustaw przed jazdą. Odpowiadaj na głos w pauzach.</p>
        <p className="mt-1">
          Przy zablokowanym ekranie wiele przeglądarek (zwłaszcza iOS) wstrzymuje syntezę mowy — najpewniej działa z włączonym ekranem lub z gotowymi nagraniami (na razie ich
          nie ma). Pełne odtwarzanie w tle może wymagać aplikacji natywnej.
        </p>
      </Notice>
      {!canPlay && <Notice tone="warn">Brak głosu pt-PT na tym urządzeniu — Tryb Auto nie może odtwarzać portugalskiego. Zobacz Ustawienia → Audio.</Notice>}
      {canPlay && !audio?.polish && prompts !== 'none' && <Notice tone="info">Brak polskiego głosu — polskie znaczenie pojawi się tylko na ekranie (z pauzą).</Notice>}

      <Card className="space-y-3">
        <div className="grid gap-2" role="radiogroup" aria-label="Rodzaj sesji">
          {savedForToday && (
            <button
              role="radio"
              aria-checked={kind === 'saved'}
              disabled={playing}
              onClick={() => setKind('saved')}
              className={cx('focus-ring rounded-xl border-2 p-3 text-left', kind === 'saved' ? 'border-atlantic-600' : 'border-[var(--border)]')}
            >
              <span className="flex items-center gap-2 font-semibold">
                <CalendarClock className="size-4" /> {savedForToday.titlePl}
              </span>
              <span className="text-xs text-[var(--muted)]">Przygotowana wcześniej · {savedForToday.itemIds.length} elementów</span>
            </button>
          )}
          {KINDS.map((k) => (
            <button
              key={k.v}
              role="radio"
              aria-checked={kind === k.v}
              disabled={playing}
              onClick={() => setKind(k.v)}
              className={cx('focus-ring rounded-xl border-2 p-3 text-left', kind === k.v ? 'border-atlantic-600' : 'border-[var(--border)]')}
            >
              <span className="block font-semibold">{k.label}</span>
              <span className="text-xs text-[var(--muted)]">{k.desc}</span>
            </button>
          ))}
        </div>
        {kind === 'lesson' && (
          <label className="block text-sm">
            <span className="font-medium">Lekcja</span>
            <select
              className="focus-ring mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2"
              value={lessonId ?? lastDone?.id ?? ''}
              onChange={(e) => setLessonId(e.target.value)}
              disabled={playing}
            >
              {course.lessons
                .filter((l) => course.completedIds.has(l.id))
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    T{l.week}.{l.day} {l.titlePl}
                  </option>
                ))}
            </select>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Długość:</span>
          {[5, 10, 20, 30].map((m) => (
            <button key={m} disabled={playing} onClick={() => setMinutes(m)} className={cx('focus-ring rounded-full border px-3 py-1 text-sm', minutes === m ? 'border-atlantic-600 bg-atlantic-600 text-white' : 'border-[var(--border)]')}>
              {m} min
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Podpowiedzi PL:</span>
          {PROMPTS.map(([v, l]) => (
            <button key={v} disabled={playing} onClick={() => setPrompts(v)} className={cx('focus-ring rounded-full border px-3 py-1 text-sm', prompts === v ? 'border-atlantic-600 bg-atlantic-600 text-white' : 'border-[var(--border)]')}>
              {l}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[#1f6fb2]" checked={backchain} disabled={playing} onChange={(e) => setBackchain(e.target.checked)} />
          Długie zdania buduj od końca (fragment → dłuższy fragment → całość)
        </label>
        <p className="text-xs text-[var(--muted)]">
          {items.length} elementów · ok. {Math.max(1, Math.round(estimateSeconds(steps) / 60))} min. Schemat: polskie znaczenie → pauza na Twoją odpowiedź → portugalski → pauza na
          powtórzenie → portugalski.
        </p>
        <Button variant="secondary" size="sm" onClick={prepareTomorrow} disabled={playing}>
          <CalendarClock className="size-4" /> Przygotuj playlistę na jutro
        </Button>
        {note && <p className="text-sm" role="status">{note}</p>}
      </Card>

      {items.length === 0 ? (
        <Notice tone="info">Brak materiału dla tej sesji — ukończ lekcję albo wybierz inny rodzaj.</Notice>
      ) : (
        <Card className="space-y-4 text-center">
          <p className="min-h-14 text-lg font-semibold" aria-live="polite" lang={label.startsWith('PT') ? 'pt-PT' : 'pl'} data-testid="auto-label">
            {label || (pos > 0 ? 'Wstrzymano — naciśnij, aby kontynuować' : 'Gotowe do odtwarzania')}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" aria-label="Poprzedni element" onClick={prevBlock}>
              <SkipBack className="size-5" />
            </Button>
            <button
              type="button"
              disabled={!canPlay}
              aria-label={playing ? 'Pauza' : pos > 0 ? 'Wznów' : 'Odtwarzaj'}
              onClick={() => (playing ? stopPlayback() : void run(pos))}
              className="focus-ring grid size-24 place-items-center rounded-full bg-atlantic-600 text-white shadow-lg disabled:opacity-40"
            >
              {playing ? <Pause className="size-10" /> : <Play className="size-10" />}
            </button>
            <Button variant="secondary" aria-label="Następny element" onClick={nextBlock}>
              <SkipForward className="size-5" />
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Tempo">
            {([0.75, 1, 1.15] as PlaybackRate[]).map((r) => (
              <button
                key={r}
                role="radio"
                aria-checked={settings.playbackRate === r}
                onClick={() => update({ playbackRate: r })}
                className={cx('focus-ring rounded-full border px-3 py-1 text-sm', settings.playbackRate === r ? 'border-atlantic-600 bg-atlantic-600 text-white' : 'border-[var(--border)]')}
              >
                {String(r).replace('.', ',')}×
              </button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              aria-label="Zatrzymaj i wróć do początku"
              onClick={() => {
                stopPlayback();
                setPos(0);
                setLabel('');
                saveProgress(sessionKey, 0);
              }}
            >
              <Square className="size-4" />
            </Button>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[var(--surface-2)]" role="progressbar" aria-label="Postęp sesji" aria-valuenow={Math.round((pos / Math.max(1, steps.length)) * 100)}>
            <div className="h-full rounded-full bg-laurel-600" style={{ width: `${(pos / Math.max(1, steps.length)) * 100}%` }} />
          </div>
          <p className="text-xs text-[var(--muted)]">
            Element {Math.min(currentBlock + 1, blocks.length)} z {blocks.length}
          </p>
          <div className="text-left">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase text-[var(--muted)]">
              <ListMusic className="size-3.5" /> Kolejka
            </p>
            <ol className="space-y-1 text-sm" data-testid="auto-queue">
              {queue.map((s, i) => {
                const it = getItem(s.itemId);
                const v = itemView(it, settings.gender);
                return (
                  <li key={`${s.itemId}-${i}`} className={cx('truncate rounded-lg px-2 py-1', i === 0 && current && 'bg-atlantic-100/60 font-semibold dark:bg-atlantic-700/25')}>
                    <span lang="pt-PT">{v.pt}</span> <span className="text-[var(--muted)]">· {v.pl}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </Card>
      )}
    </div>
  );
}
