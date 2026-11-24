import { useState } from 'react';
import { Eye, EyeOff, Info } from 'lucide-react';
import type { LearningItem } from '@/content/schema';
import { describeStress } from '@/content/phonetics';
import { itemView } from '@/lib/items';
import { useApp } from '@/state/AppContext';
import { AudioButton } from './Audio';
import { Phon } from './Phon';
import { Recorder } from './Recorder';
import { Badge, cx } from './ui';
import { SaveButton } from './SaveButton';

export const STATUS_LABEL = {
  draft: 'szkic — niezweryfikowany',
  automatedChecked: 'sprawdzony automatycznie (bez weryfikacji człowieka)',
  humanVerified: 'zweryfikowany przez recenzenta',
} as const;

export function ReviewBadge({ item }: { item: LearningItem }) {
  if (item.reviewStatus === 'humanVerified' && !item.pronunciation.needsReview) return <Badge tone="ok">zweryfikowane</Badge>;
  return (
    <Badge tone="warn" title={`Status treści: ${STATUS_LABEL[item.reviewStatus]}. Zapis wymowy to przybliżenie — porównuj z nagraniem.`}>
      wymowa niezweryfikowana
    </Badge>
  );
}

/**
 * Cztery warstwy elementu: PT · PL · Wymowa PL · Audio (+ IPA, akcent, uwaga, wersja naturalna, nagrywanie).
 */
export function PronunciationCard({
  item,
  variant = 'full',
  forceFem,
  showRecorder = false,
  hidePl = false,
  className,
  saveSource,
}: {
  item: LearningItem;
  variant?: 'full' | 'compact' | 'row';
  forceFem?: boolean;
  showRecorder?: boolean;
  hidePl?: boolean;
  className?: string;
  /** Pokaż gwiazdkę „Moje zdania” (domyślnie w kartach pełnych i kompaktowych). */
  saveSource?: 'lesson' | 'cheatsheet' | 'reading' | 'other' | false;
}) {
  const { settings } = useApp();
  const v = itemView(item, settings.gender, forceFem);
  const [showPron, setShowPron] = useState(settings.showPronunciation);
  const [natural, setNatural] = useState(false);
  const stress = v.pron.stress ?? (v.pron.plSlow ? describeStress(v.pron.plSlow) : null);
  const phonText = natural && v.pron.plNatural ? v.pron.plNatural : v.pron.plSlow;

  if (variant === 'row') {
    return (
      <div className={cx('flex items-center gap-3 py-2', className)}>
        <AudioButton item={item} fem={v.fem} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight" lang="pt-PT">
            {v.pt}
          </p>
          {showPron && v.pron.plSlow && <Phon text={v.pron.plSlow} size="sm" className="text-[var(--muted)]" />}
        </div>
        {!hidePl && <p className="max-w-[45%] text-right text-sm text-[var(--muted)]">{v.pl}</p>}
      </div>
    );
  }

  return (
    <div className={cx('min-w-0 break-words rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-2">
          <AudioButton item={item} fem={v.fem} size={variant === 'full' ? 'lg' : 'md'} />
          <AudioButton item={item} fem={v.fem} slow size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1">
            <p className={cx('flex-1 font-bold leading-snug', variant === 'full' ? 'text-2xl' : 'text-lg')} lang="pt-PT">
              {v.pt}
            </p>
            {saveSource !== false && <SaveButton itemId={item.id} source={saveSource ?? 'other'} className="-mr-1 -mt-1" />}
          </div>
          {!hidePl && <p className="mt-0.5 text-[var(--muted)]">{v.pl}</p>}
          <div className="mt-2">
            {showPron && phonText ? (
              <div>
                <Phon text={phonText} size={variant === 'full' ? 'lg' : 'md'} />
                {settings.showIpa && v.pron.ipa && <p className="phon mt-0.5 text-sm text-[var(--muted)]">[{v.pron.ipa}]</p>}
              </div>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="focus-ring inline-flex items-center gap-1 rounded-md text-xs text-[var(--muted)] underline-offset-2 hover:underline"
                onClick={() => setShowPron((s) => !s)}
                aria-pressed={showPron}
              >
                {showPron ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />} {showPron ? 'Ukryj wymowę' : 'Pokaż wymowę'}
              </button>
              {showPron && v.pron.plNatural && (
                <button
                  type="button"
                  className={cx('focus-ring rounded-full border px-2 py-0.5 text-xs', natural ? 'border-atlantic-600 text-atlantic-700 dark:text-atlantic-100' : 'border-[var(--border)] text-[var(--muted)]')}
                  onClick={() => setNatural((n) => !n)}
                  aria-pressed={natural}
                >
                  {natural ? 'wersja naturalna' : 'pokaż wersję naturalną'}
                </button>
              )}
              {showPron && stress && <span className="text-xs text-[var(--muted)]">{stress}</span>}
              <ReviewBadge item={item} />
            </div>
          </div>
        </div>
      </div>
      {variant === 'full' && (v.pron.notePl || item.usagePl) && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-[var(--surface-2)] p-3 text-sm">
          {v.pron.notePl && (
            <p className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-atlantic-600" />
              <span>{v.pron.notePl}</span>
            </p>
          )}
          {item.usagePl && <p className="text-[var(--muted)]">{item.usagePl}</p>}
        </div>
      )}
      {showRecorder && (
        <div className="mt-3 border-t border-[var(--border)] pt-3">
          <p className="mb-2 text-xs text-[var(--muted)]">Powtórz na głos. Możesz się nagrać i porównać z wzorcem (przycisk głośnika).</p>
          <Recorder label={v.pt} itemId={item.id} compact />
        </div>
      )}
    </div>
  );
}
