import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Dialogue } from '@/content/schema';
import { getItem, itemView } from '@/lib/items';
import { useApp } from '@/state/AppContext';
import { AudioButton, useAudioAvailable, usePlayer } from './Audio';
import { Phon } from './Phon';
import { Button, cx } from './ui';

export function DialogueView({ dialogue }: { dialogue: Dialogue }) {
  const { settings } = useApp();
  const { play, stop } = usePlayer();
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [hidePl, setHidePl] = useState(false);
  const [showPron, setShowPron] = useState(settings.showPronunciation);
  const cancel = useRef(false);
  const { available } = useAudioAvailable(getItem(dialogue.lines[0]!.itemId));

  const playAll = async () => {
    cancel.current = false;
    for (let i = 0; i < dialogue.lines.length; i++) {
      if (cancel.current) break;
      const line = dialogue.lines[i]!;
      setPlayingIdx(i);
      const fem = line.fem ?? (line.isLearner ? settings.gender === 'f' : false);
      const r = await play(getItem(line.itemId), { fem, repeat: 1, key: `dlg-${i}` });
      if (!r.ok) break;
      await new Promise((res) => setTimeout(res, 600));
    }
    setPlayingIdx(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">{dialogue.contextPl}</p>
      <div className="flex flex-wrap gap-2">
        {available && (
          <Button
            size="sm"
            variant={playingIdx !== null ? 'danger' : 'primary'}
            onClick={() => {
              if (playingIdx !== null) {
                cancel.current = true;
                stop();
                setPlayingIdx(null);
              } else void playAll();
            }}
          >
            {playingIdx !== null ? <Pause className="size-4" /> : <Play className="size-4" />} {playingIdx !== null ? 'Zatrzymaj' : 'Odtwórz cały dialog'}
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => setHidePl((h) => !h)} aria-pressed={hidePl}>
          {hidePl ? 'Pokaż tłumaczenie' : 'Ukryj tłumaczenie'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setShowPron((h) => !h)} aria-pressed={showPron}>
          {showPron ? 'Ukryj wymowę' : 'Pokaż wymowę'}
        </Button>
      </div>
      <ol className="space-y-2">
        {dialogue.lines.map((line, i) => {
          const it = getItem(line.itemId);
          const fem = line.fem ?? (line.isLearner ? settings.gender === 'f' : false);
          const v = itemView(it, settings.gender, fem);
          return (
            <li key={i} className={cx('flex gap-2', line.isLearner && 'flex-row-reverse')}>
              <div
                className={cx(
                  'max-w-[88%] rounded-2xl border p-3',
                  line.isLearner ? 'border-atlantic-500/40 bg-atlantic-100/60 dark:bg-atlantic-700/25' : 'border-[var(--border)] bg-[var(--surface)]',
                  playingIdx === i && 'ring-2 ring-atlantic-500',
                )}
              >
                <p className="mb-1 text-xs font-semibold text-[var(--muted)]">{line.isLearner ? `${line.speaker} (Ty)` : line.speaker}</p>
                <div className="flex items-start gap-2">
                  <AudioButton item={it} fem={v.fem} size="sm" repeat={1} />
                  <div className="min-w-0">
                    <p className="font-semibold" lang="pt-PT">{v.pt}</p>
                    {showPron && v.pron.plSlow && <Phon text={v.pron.plSlow} size="sm" className="text-[var(--muted)]" />}
                    {!hidePl && <p className="text-sm text-[var(--muted)]">{v.pl}</p>}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
