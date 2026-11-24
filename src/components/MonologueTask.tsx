import { useEffect, useRef, useState } from 'react';
import { Mic, Play, Square } from 'lucide-react';
import { recordingSupported, startRecording, type RecordingHandle } from '@/lib/recorder';
import { saveRecording } from '@/db/repo';
import { Button, Notice } from './ui';

/** Monolog na czas: nagranie (jeśli jest mikrofon), licznik, lista kontrolna do samooceny. */
export function MonologueTask({
  id,
  promptPl,
  hintPl,
  targetSeconds,
  checklistPl,
  onDone,
}: {
  id: string;
  promptPl: string;
  hintPl?: string;
  targetSeconds: number;
  checklistPl: string[];
  onDone: (r: { checked: number; total: number; seconds: number }) => void;
}) {
  const [phase, setPhase] = useState<'ready' | 'talking' | 'check'>('ready');
  const [elapsed, setElapsed] = useState(0);
  const [checked, setChecked] = useState<boolean[]>(() => checklistPl.map(() => false));
  const [note, setNote] = useState<string | null>(null);
  const handle = useRef<RecordingHandle | null>(null);
  const rec = useRef<{ blob: Blob; mime: string; durationMs: number } | null>(null);
  const t0 = useRef(0);

  useEffect(() => {
    if (phase !== 'talking') return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - t0.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => () => handle.current?.cancel(), []);

  const start = async () => {
    if (recordingSupported()) {
      try {
        handle.current = await startRecording((targetSeconds + 120) * 1000);
      } catch {
        setNote('Bez mikrofonu — mów na głos, licznik działa.');
      }
    }
    t0.current = Date.now();
    setElapsed(0);
    setPhase('talking');
  };
  const stop = async () => {
    if (handle.current) {
      rec.current = await handle.current.stop();
      handle.current = null;
      await saveRecording({ taskId: `test-${id}`, label: `Monolog: ${promptPl}`, ...rec.current });
    }
    setPhase('check');
  };

  return (
    <div className="space-y-3" data-testid="monologue">
      <p className="text-xl font-semibold">{promptPl}</p>
      {hintPl && <p className="text-sm text-[var(--muted)]">{hintPl}</p>}
      <p className="text-sm">Cel: ok. {targetSeconds} s. Plan (możesz zerknąć przed startem):</p>
      <ul className="list-inside list-disc text-sm text-[var(--muted)]">
        {checklistPl.map((c) => (
          <li key={c}>{c.replace(/^Powiedziałem\/am, /, '').replace(/^Przywitałem\/am się/, 'przywitanie')}</li>
        ))}
      </ul>
      {phase === 'ready' && (
        <Button size="lg" className="w-full" onClick={start}>
          <Mic className="size-5" /> Zaczynam mówić
        </Button>
      )}
      {phase === 'talking' && (
        <div className="space-y-2 text-center">
          <p className="text-5xl font-bold tabular-nums" aria-live="polite">
            {elapsed} s
          </p>
          <p className="text-sm text-[var(--muted)]">{elapsed < targetSeconds ? `jeszcze ok. ${targetSeconds - elapsed} s` : 'Cel osiągnięty — możesz kończyć albo mówić dalej'}</p>
          <Button variant="danger" onClick={stop}>
            <Square className="size-4" /> Koniec
          </Button>
        </div>
      )}
      {phase === 'check' && (
        <div className="space-y-2">
          {rec.current && (
            <Button variant="secondary" onClick={() => void new Audio(URL.createObjectURL(rec.current!.blob)).play()}>
              <Play className="size-4" /> Odsłuchaj siebie
            </Button>
          )}
          <p className="font-medium">Zaznacz, co udało Ci się powiedzieć (samoocena):</p>
          {checklistPl.map((c, i) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-5 accent-[#1f6fb2]" checked={checked[i]} onChange={(e) => setChecked((xs) => xs.map((x, k) => (k === i ? e.target.checked : x)))} />
              {c}
            </label>
          ))}
          <Button className="w-full" onClick={() => onDone({ checked: checked.filter(Boolean).length, total: checklistPl.length, seconds: elapsed })}>
            Zapisz i dalej
          </Button>
        </div>
      )}
      {note && <Notice tone="info">{note}</Notice>}
    </div>
  );
}
