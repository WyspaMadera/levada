import { useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Eye } from 'lucide-react';
import type { SpeakingTask } from '@/content/schema';
import { db, type SelfRating } from '@/db/db';
import { getItem, itemView } from '@/lib/items';
import { useApp } from '@/state/AppContext';
import { AudioButton } from './Audio';
import { Phon } from './Phon';
import { PronunciationCard } from './PronunciationCard';
import { Recorder } from './Recorder';
import { Button, Notice } from './ui';

/** Zadanie „Mówię samodzielnie”: polecenie → próba na głos (opcjonalnie nagranie) → wzór → samoocena. */
export function SpeakingTaskView({ task, onDone }: { task: SpeakingTask; onDone: (r: { self: SelfRating; seconds: number }) => void }) {
  const { settings } = useApp();
  const profile = useLiveQuery(() => db.profile.get('profile'), []);
  const [revealed, setRevealed] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [rated, setRated] = useState<SelfRating | null>(null);

  const personal = task.personal;
  const value = personal ? profile?.[personal.field] : undefined;
  const tmplItem = personal ? getItem(personal.templateItemId) : null;
  const tv = tmplItem ? itemView(tmplItem, settings.gender) : null;

  const rate = (self: SelfRating) => {
    setRated(self);
    onDone({ self, seconds: Math.max(seconds, 6) });
  };

  return (
    <div className="space-y-4" data-testid="speaking-task">
      <p className="text-xl font-semibold">{task.promptPl}</p>
      {task.hintPl && <p className="text-sm text-[var(--muted)]">{task.hintPl}</p>}

      {personal && tmplItem && tv && (
        <div className="rounded-2xl border border-atlantic-500/40 bg-atlantic-100/50 p-3 dark:bg-atlantic-700/20">
          <p className="text-xs font-semibold uppercase text-atlantic-700 dark:text-atlantic-100">Twoja wersja</p>
          {value ? (
            <>
              <p className="mt-1 text-lg font-semibold" lang="pt-PT">
                {personal.templatePt.replace(`{${personal.field}}`, value)}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <AudioButton item={tmplItem} size="sm" label="Odsłuchaj wzór zdania" repeat={1} />
                {tv.pron.plSlow && <Phon text={tv.pron.plSlow.replace('…', value)} size="sm" />}
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">„{value}” wymawiasz po swojemu — nie zgadujemy wymowy imion i nazw własnych.</p>
            </>
          ) : (
            <p className="mt-1 text-sm">
              Wpisz dane w <Link to="/zyciorys" className="underline">Mój portugalski życiorys</Link>, a zdanie dopasuje się do Ciebie. Na razie użyj wzoru poniżej.
            </p>
          )}
        </div>
      )}

      <Notice tone="info">Powiedz to na głos, zanim zobaczysz wzór. Nagrywanie jest opcjonalne.</Notice>
      <Recorder label={task.promptPl} taskId={task.id} onRecorded={(s) => setSeconds((x) => x + s)} />

      {!revealed ? (
        <Button variant="outline" className="w-full" onClick={() => setRevealed(true)}>
          <Eye className="size-4" /> Pokaż przykładową odpowiedź
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-medium">Przykładowa odpowiedź:</p>
          {task.modelItemIds.map((id) => (
            <PronunciationCard key={id} item={getItem(id)} variant="compact" />
          ))}
        </div>
      )}

      {revealed && !rated && (
        <div>
          <p className="mb-2 text-sm font-medium">Jak Ci poszło? (samoocena — aplikacja nie ocenia akcentu automatycznie)</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="success" onClick={() => rate('can')}>Umiem</Button>
            <Button variant="secondary" onClick={() => rate('almost')}>Prawie</Button>
            <Button variant="secondary" onClick={() => rate('cannot')}>Nie umiem</Button>
          </div>
        </div>
      )}
    </div>
  );
}
