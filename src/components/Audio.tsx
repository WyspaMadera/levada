import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Loader2, Snail, Volume2, VolumeX } from 'lucide-react';
import type { LearningItem } from '@/content/schema';
import { content } from '@/content/content';
import { playItem, stopAll, type PlayResult } from '@/lib/audio';
import { useApp } from '@/state/AppContext';
import { cx } from './ui';

export function useAudioAvailable(item?: LearningItem) {
  const { audio } = useApp();
  const hasRecording = item ? Boolean(content.audio.files[item.id]) : false;
  return { available: hasRecording || Boolean(audio?.choice.voice), hasRecording, br: audio?.choice.status === 'pt-BR-fallback', audio };
}

/** Hook odtwarzania z ustawieniami użytkownika. */
export function usePlayer() {
  const { audio, settings } = useApp();
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [lastError, setLastError] = useState<PlayResult | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const play = useCallback(
    async (item: LearningItem, opts: { slow?: boolean; fem?: boolean; repeat?: number; key?: string } = {}) => {
      if (!audio) return { ok: false, reason: 'unsupported' } as PlayResult;
      const key = opts.key ?? `${item.id}:${opts.slow ? 's' : 'n'}`;
      setPlayingKey(key);
      const r = await playItem(item, audio.choice, {
        rate: opts.slow ? 0.75 : settings.playbackRate,
        slow: opts.slow,
        fem: opts.fem,
        repeat: opts.repeat ?? settings.repeatCount,
      });
      if (mounted.current) {
        setPlayingKey((k) => (k === key ? null : k));
        setLastError(r.ok ? null : r);
      }
      return r;
    },
    [audio, settings.playbackRate, settings.repeatCount],
  );
  const stop = useCallback(() => {
    stopAll();
    setPlayingKey(null);
  }, []);
  return { play, stop, playingKey, lastError };
}

export function AudioButton({
  item,
  fem,
  slow,
  size = 'md',
  label,
  repeat,
  className,
}: {
  item: LearningItem;
  fem?: boolean;
  slow?: boolean;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  repeat?: number;
  className?: string;
}) {
  const { play, stop, playingKey, lastError } = usePlayer();
  const { available, br } = useAudioAvailable(item);
  const key = `${item.id}:${slow ? 's' : 'n'}:${fem ? 'f' : 'm'}`;
  const playing = playingKey === key;
  const Icon = !available ? VolumeX : slow ? Snail : Volume2;
  const aria = label ?? (slow ? `Odsłuchaj wolniej: ${item.pt}` : `Odsłuchaj: ${item.pt}`);
  return (
    <span className={cx('inline-flex flex-col items-center', className)}>
      <button
        type="button"
        aria-label={aria}
        title={!available ? 'Brak głosu pt-PT na tym urządzeniu — zobacz Ustawienia → Audio' : aria}
        onClick={() => (playing ? stop() : play(item, { slow, fem, key, repeat }))}
        className={cx(
          'focus-ring relative grid shrink-0 place-items-center rounded-full transition',
          size === 'sm' && 'size-9',
          size === 'md' && 'size-12',
          size === 'lg' && 'size-16',
          available
            ? slow
              ? 'bg-[var(--surface-2)] text-atlantic-700 border border-[var(--border)] dark:text-atlantic-100'
              : 'bg-atlantic-600 text-white shadow hover:bg-atlantic-700 dark:bg-atlantic-500'
            : 'bg-[var(--surface-2)] text-[var(--muted)] border border-dashed border-[var(--border)]',
        )}
      >
        {playing ? <Loader2 className="size-1/2 animate-spin" /> : <Icon className="size-1/2" />}
        {br && available && !slow && (
          <span className="absolute -right-1 -top-1 rounded bg-amber-700 px-1 text-[9px] font-bold text-white" title="Głos brazylijski (pt-BR) — wymowa różni się od PT-PT">
            BR
          </span>
        )}
      </button>
      {lastError && !lastError.ok && lastError.reason === 'no-voice' && (
        <Link to="/ustawienia#audio" className="mt-1 text-[11px] text-coral-600 underline">
          brak głosu pt-PT
        </Link>
      )}
    </span>
  );
}
