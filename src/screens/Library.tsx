import { useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { content } from '@/content/content';
import { LIBRARY_LEVELS, type LibrarySource } from '@/content/schema';
import { Badge, Card, Notice, PageHeader, cx } from '@/components/ui';

const LEVEL_PL: Record<(typeof LIBRARY_LEVELS)[number], string> = {
  poczatkujacy: 'Zupełnie początkujący',
  A1: 'A1',
  A2: 'A2',
  B1: 'B1',
  naturalny: 'Naturalny portugalski',
  madera: 'Portugalski z Madery',
};
const KIND_PL: Record<LibrarySource['kind'], string> = { podcast: 'podcast', youtube: 'YouTube', radio: 'radio', website: 'strona', tool: 'narzędzie' };
const COST_PL: Record<LibrarySource['cost'], [string, 'ok' | 'warn' | 'neutral']> = {
  free: ['bezpłatne', 'ok'],
  freemium: ['część płatna', 'warn'],
  paid: ['płatne', 'warn'],
  unknown: ['koszt nieustalony', 'neutral'],
};
const TRANSCRIPT_PL: Record<LibrarySource['transcript'], string> = { yes: 'z transkrypcją', partial: 'transkrypcja częściowo', no: 'bez transkrypcji', unknown: 'transkrypcja: brak informacji' };

export default function Library() {
  const [level, setLevel] = useState<(typeof LIBRARY_LEVELS)[number] | null>(null);
  const list = content.library.filter((s) => !level || s.levels.includes(level));
  return (
    <div className="space-y-4">
      <PageHeader title="Słuchaj portugalskiego" subtitle="Sprawdzone źródła zewnętrzne — podcasty, YouTube, radio" back="/sluchanie" />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Poziom">
        <button role="radio" aria-checked={level === null} onClick={() => setLevel(null)} className={cx('focus-ring rounded-full border px-3 py-1 text-sm', level === null ? 'border-atlantic-600 bg-atlantic-600 text-white' : 'border-[var(--border)]')}>
          wszystkie
        </button>
        {LIBRARY_LEVELS.map((l) => (
          <button key={l} role="radio" aria-checked={level === l} onClick={() => setLevel(l)} className={cx('focus-ring rounded-full border px-3 py-1 text-sm', level === l ? 'border-atlantic-600 bg-atlantic-600 text-white' : 'border-[var(--border)]')}>
            {LEVEL_PL[l]}
          </button>
        ))}
      </div>
      {content.library.length === 0 && <Notice tone="info">Lista źródeł jest w przygotowaniu (każde źródło sprawdzamy przed dodaniem).</Notice>}
      {list.map((s) => (
        <Card key={s.id} className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs text-[var(--muted)]">
                {KIND_PL[s.kind]} · {s.levels.map((l) => LEVEL_PL[l]).join(', ')}
                {s.approxTimePl ? ` · ${s.approxTimePl}` : ''}
              </p>
            </div>
            <Badge tone={COST_PL[s.cost][1]}>{COST_PL[s.cost][0]}</Badge>
          </div>
          <p className="text-sm">{s.descriptionPl}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={s.variant === 'pt-PT' ? 'info' : 'neutral'}>{s.variant === 'pt-PT' ? 'portugalski europejski' : s.variant === 'mixed' ? 'PT-PT i PT-BR' : 'wariant: brak informacji'}</Badge>
            <Badge>{TRANSCRIPT_PL[s.transcript]}</Badge>
          </div>
          {s.notesPl && <p className="text-xs text-[var(--muted)]">{s.notesPl}</p>}
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium underline">
            Otwórz <ExternalLink className="size-3.5" />
          </a>
          <p className="text-[11px] text-[var(--muted)]">
            {s.verifiedHow === 'page' ? 'Sprawdzone na stronie' : 'Sprawdzone w wynikach wyszukiwania (strona nie była otwierana) — jeśli link nie działa, daj znać'}: {s.verifiedAt}. Treści należą do ich autorów —
            Levada tylko do nich linkuje.
          </p>
        </Card>
      ))}
    </div>
  );
}
