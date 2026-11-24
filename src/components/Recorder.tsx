import { useEffect, useRef, useState } from 'react';
import { Mic, Play, Save, Square, Trash2 } from 'lucide-react';
import { recordingSupported, startRecording, type RecordingHandle } from '@/lib/recorder';
import { saveRecording } from '@/db/repo';
import { Button, cx } from './ui';

type Props = {
  label: string;
  itemId?: string;
  taskId?: string;
  /** Wywoływane po zakończeniu nagrania (czas w sekundach — liczony jako „mówienie”). */
  onRecorded?: (seconds: number) => void;
  compact?: boolean;
};

/** Nagraj → odsłuchaj siebie → (opcjonalnie) zapisz. Nagrania zostają na urządzeniu. */
export function Recorder({ label, itemId, taskId, onRecorded, compact }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const handle = useRef<RecordingHandle | null>(null);
  const blobRef = useRef<{ blob: Blob; mime: string; durationMs: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      handle.current?.cancel();
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  if (!recordingSupported()) {
    return <p className="text-xs text-[var(--muted)]">Nagrywanie nie jest obsługiwane w tej przeglądarce. Powiedz zdanie na głos i porównaj z wzorcem.</p>;
  }

  const start = async () => {
    setError(null);
    setSaved(false);
    try {
      handle.current = await startRecording();
      setState('recording');
    } catch (e) {
      setState('error');
      setError(
        (e as Error).name === 'NotAllowedError'
          ? 'Brak zgody na mikrofon. Możesz ją włączyć w ustawieniach przeglądarki — albo po prostu mów na głos bez nagrywania.'
          : 'Nie udało się uruchomić mikrofonu.',
      );
    }
  };
  const stop = async () => {
    if (!handle.current) return;
    const res = await handle.current.stop();
    handle.current = null;
    blobRef.current = res;
    if (url) URL.revokeObjectURL(url);
    setUrl(URL.createObjectURL(res.blob));
    setState('done');
    onRecorded?.(res.durationMs / 1000);
  };
  const playMine = () => {
    if (!url) return;
    audioRef.current?.pause();
    audioRef.current = new Audio(url);
    void audioRef.current.play();
  };
  const save = async () => {
    if (!blobRef.current) return;
    await saveRecording({ itemId, taskId, label, ...blobRef.current });
    setSaved(true);
  };
  const discard = () => {
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    blobRef.current = null;
    setState('idle');
  };

  return (
    <div className={cx('flex flex-wrap items-center gap-2', compact && 'gap-1.5')}>
      {state !== 'recording' ? (
        <Button variant="secondary" size={compact ? 'sm' : 'md'} onClick={start} aria-label="Nagraj siebie">
          <Mic className="size-4" /> {state === 'done' ? 'Nagraj ponownie' : 'Nagraj siebie'}
        </Button>
      ) : (
        <Button variant="danger" size={compact ? 'sm' : 'md'} onClick={stop} aria-label="Zatrzymaj nagrywanie">
          <Square className="size-4" /> <span className="animate-pulse">Nagrywam… stop</span>
        </Button>
      )}
      {state === 'done' && (
        <>
          <Button variant="secondary" size={compact ? 'sm' : 'md'} onClick={playMine} aria-label="Odsłuchaj swoje nagranie">
            <Play className="size-4" /> Ja
          </Button>
          {!saved ? (
            <Button variant="ghost" size="sm" onClick={save} aria-label="Zapisz nagranie na urządzeniu">
              <Save className="size-4" /> Zapisz
            </Button>
          ) : (
            <span className="text-xs text-laurel-700 dark:text-laurel-100">Zapisane (na tym urządzeniu)</span>
          )}
          <Button variant="ghost" size="sm" onClick={discard} aria-label="Usuń to nagranie">
            <Trash2 className="size-4" />
          </Button>
        </>
      )}
      {error && <p className="w-full text-xs text-coral-600">{error}</p>}
    </div>
  );
}
