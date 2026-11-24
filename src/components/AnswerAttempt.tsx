import { useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Eye, Mic } from 'lucide-react';
import { db, type SelfRating } from '@/db/db';
import { getItem, itemView } from '@/lib/items';
import { recognizeOnce, speechRecognitionSupported } from '@/lib/recorder';
import { useApp } from '@/state/AppContext';
import { AudioButton } from './Audio';
import { Phon } from './Phon';
import { PronunciationCard } from './PronunciationCard';
import { Recorder } from './Recorder';
import { Button, Notice } from './ui';

type Personal = { field: 'name' | 'city' | 'country' | 'job'; templatePt: string; templateItemId: string };

/**
 * Jedna próba odpowiedzi: próbuję sam(a) → (nagranie / rozpoznanie mowy — opcjonalnie) → warianty wzorcowe → samoocena.
 * Rozpoznanie mowy jest tylko orientacyjne i NIE ocenia wymowy.
 */
export function AnswerAttempt({
  taskPl,
  answerItemIds,
  personal,
  usefulItemIds,
  onRated,
  revealLabel = 'Pokaż przykładowe odpowiedzi',
}: {
  taskPl: string;
  answerItemIds: string[];
  personal?: Personal;
  usefulItemIds?: string[];
  onRated: (r: { self: SelfRating; seconds: number; recognized?: string }) => void;
  revealLabel?: string;
}) {
  const { settings } = useApp();
  const profile = useLiveQuery(() => db.profile.get('profile'), []);
  const [revealed, setRevealed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recognized, setRecognized] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [srError, setSrError] = useState<string | null>(null);
  const value = personal ? profile?.[personal.field] : undefined;
  const tmpl = personal ? getItem(personal.templateItemId) : null;
  const tv = tmpl ? itemView(tmpl, settings.gender) : null;

  const recognize = async () => {
    setSrError(null);
    setListening(true);
    try {
      const alts = await recognizeOnce('pt-PT').promise;
      setRecognized(alts[0] ?? '');
    } catch {
      setSrError('Rozpoznawanie mowy nie zadziałało (brak zgody na mikrofon, brak internetu lub brak obsługi pt-PT).');
    } finally {
      setListening(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="font-semibold">{taskPl}</p>
      {usefulItemIds && usefulItemIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Przydatne słowa">
          {usefulItemIds.map((id) => {
            const it = getItem(id);
            const v = itemView(it, settings.gender);
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] py-0.5 pl-1 pr-2.5 text-sm">
                <AudioButton item={it} size="sm" repeat={1} className="scale-75" />
                <span lang="pt-PT">{v.pt}</span>
                <span className="text-[var(--muted)]">· {v.pl}</span>
              </span>
            );
          })}
        </div>
      )}
      {personal && tv && (
        <div className="rounded-xl border border-atlantic-500/40 bg-atlantic-100/50 p-3 text-sm dark:bg-atlantic-700/20">
          {value ? (
            <>
              <p className="font-semibold" lang="pt-PT">
                {personal.templatePt.replace(`{${personal.field}}`, value)}
              </p>
              {tv.pron.plSlow && <Phon text={tv.pron.plSlow.replace('…', value)} size="sm" />}
              <p className="mt-1 text-xs text-[var(--muted)]">„{value}” wymawiasz po swojemu — nie zgadujemy wymowy nazw własnych.</p>
            </>
          ) : (
            <p>
              Wzór: <span lang="pt-PT">{personal.templatePt.replace(`{${personal.field}}`, '…')}</span> — uzupełnij{' '}
              <Link className="underline" to="/zyciorys">
                życiorys
              </Link>
              , a zdanie dopasuje się do Ciebie.
            </p>
          )}
        </div>
      )}
      <Recorder label={taskPl} onRecorded={(s) => setSeconds((x) => x + s)} compact />
      {speechRecognitionSupported() && (
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={recognize} disabled={listening}>
            <Mic className="size-4" /> {listening ? 'Słucham…' : 'Rozpoznaj, co mówię (orientacyjnie)'}
          </Button>
          {recognized !== null && (
            <p className="text-sm">
              Rozpoznano: <strong lang="pt-PT">{recognized || '—'}</strong>
              <span className="block text-xs text-[var(--muted)]">To automatyczna transkrypcja, nie ocena wymowy — może się mylić.</span>
            </p>
          )}
          {srError && <p className="text-xs text-coral-600">{srError}</p>}
        </div>
      )}
      {!revealed ? (
        <Button variant="outline" className="w-full" onClick={() => setRevealed(true)}>
          <Eye className="size-4" /> {revealLabel}
        </Button>
      ) : (
        <div className="space-y-2">
          {answerItemIds.length > 1 && <p className="text-sm text-[var(--muted)]">Każda z tych odpowiedzi jest dobra:</p>}
          {answerItemIds.map((id) => (
            <PronunciationCard key={id} item={getItem(id)} variant="compact" />
          ))}
          <p className="text-sm font-medium">Powtórz wybraną odpowiedź na głos i oceń siebie:</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="success" onClick={() => onRated({ self: 'can', seconds: Math.max(seconds, 5), recognized: recognized ?? undefined })}>
              Umiem
            </Button>
            <Button variant="secondary" onClick={() => onRated({ self: 'almost', seconds: Math.max(seconds, 5), recognized: recognized ?? undefined })}>
              Prawie
            </Button>
            <Button variant="secondary" onClick={() => onRated({ self: 'cannot', seconds: Math.max(seconds, 5), recognized: recognized ?? undefined })}>
              Nie umiem
            </Button>
          </div>
        </div>
      )}
      {!revealed && <Notice tone="info">Najpierw spróbuj odpowiedzieć na głos — dopiero potem sprawdź warianty.</Notice>}
    </div>
  );
}
