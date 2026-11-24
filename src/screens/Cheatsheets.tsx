import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ExternalLink, Maximize2, X } from 'lucide-react';
import { content } from '@/content/content';
import type { Cheatsheet } from '@/content/schema';
import { getItem, itemView } from '@/lib/items';
import { useApp } from '@/state/AppContext';
import { AudioButton } from '@/components/Audio';
import { Phon } from '@/components/Phon';
import { PronunciationCard } from '@/components/PronunciationCard';
import { Badge, Button, Card, Notice, PageHeader } from '@/components/ui';

const GROUPS: Record<Cheatsheet['group'], string> = {
  dziecko: 'Dziecko i przedszkole',
  urzedy: 'Urzędy',
  'praca-turystyka': 'Praca, turystyka, rezerwacje',
  codziennosc: 'Na co dzień',
};

export function CheatsheetsList() {
  return (
    <div className="space-y-4">
      <PageHeader title="Potrzebuję tego dzisiaj" subtitle="Ściągawki na konkretne sytuacje — dostępne od razu, niezależnie od postępów" back="/wiecej" />
      {content.cheatsheets.length === 0 && <Notice tone="info">Ściągawki są w przygotowaniu.</Notice>}
      {(Object.keys(GROUPS) as Cheatsheet['group'][]).map((g) => {
        const list = content.cheatsheets.filter((c) => c.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="space-y-2">
            <h2 className="font-bold">{GROUPS[g]}</h2>
            {list.map((c) => (
              <Link key={c.id} to={`/sciagawki/${c.id}`} className="block">
                <Card className="py-3">
                  <p className="font-semibold">{c.titlePl}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {c.descriptionPl} · {c.phrases.length} zwrotów
                  </p>
                </Card>
              </Link>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export default function CheatsheetView() {
  const { id = '' } = useParams();
  const c = content.cheatsheets.find((x) => x.id === id);
  const { settings } = useApp();
  const [big, setBig] = useState<string | null>(null);
  if (!c) return <Notice tone="warn">Nie ma takiej ściągawki.</Notice>;

  if (big) {
    const it = getItem(big);
    const v = itemView(it, settings.gender);
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-[var(--bg)] p-5" role="dialog" aria-label="Powiększony zwrot">
        <div className="flex justify-end">
          <button type="button" aria-label="Zamknij powiększenie" className="focus-ring rounded-full p-2" onClick={() => setBig(null)}>
            <X className="size-7" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
          <p className="text-4xl font-bold leading-tight" lang="pt-PT">{v.pt}</p>
          <p className="text-xl text-[var(--muted)]">{v.pl}</p>
          {v.pron.plSlow && <Phon text={v.pron.plSlow} size="lg" />}
          <AudioButton item={it} fem={v.fem} size="lg" repeat={1} />
        </div>
        <p className="text-center text-sm text-[var(--muted)]">Możesz pokazać ten ekran rozmówcy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PageHeader title={c.titlePl} subtitle={c.descriptionPl} back="/sciagawki" />
      {c.institution && (
        <Card className="space-y-1 text-sm">
          <p className="font-semibold" lang="pt-PT">{c.institution.namePt}</p>
          <p className="text-[var(--muted)]">{c.institution.namePl}</p>
          {c.institution.notePl && <p>{c.institution.notePl}</p>}
          {c.institution.url && (
            <a href={c.institution.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
              Strona instytucji <ExternalLink className="size-3.5" />
            </a>
          )}
          <p className="text-xs text-[var(--muted)]">
            {c.institution.verifiedHow === 'page' ? 'Nazwa i adres sprawdzone na stronie' : 'Nazwa i adres sprawdzone tylko w wynikach wyszukiwania (strona nie była otwierana)'}: {c.institution.verifiedAt}. Procedury i
            wymagania sprawdzaj zawsze bezpośrednio w instytucji.
          </p>
        </Card>
      )}
      {c.disclaimerPl && <Notice tone="info">{c.disclaimerPl}</Notice>}
      {c.phrases.map((p) => (
        <div key={p.itemId} className="relative">
          <PronunciationCard item={getItem(p.itemId)} variant="compact" saveSource="cheatsheet" />
          <div className="absolute bottom-3 right-3 flex items-center gap-1">
            {p.harder && <Badge tone="warn">trudniejsze</Badge>}
            <Button size="sm" variant="ghost" aria-label="Powiększ, aby pokazać rozmówcy" onClick={() => setBig(p.itemId)}>
              <Maximize2 className="size-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
