import { Link } from 'react-router';
import { ChevronRight, Sparkles, TriangleAlert } from 'lucide-react';
import { content } from '@/content/content';
import type { Sound } from '@/content/schema';
import { Badge, Card, Notice, PageHeader } from '@/components/ui';

const GROUPS: Record<Sound['group'], string> = { vowels: 'Samogłoski', nasals: 'Nosówki', consonants: 'Spółgłoski', prosody: 'Akcent, rytm, intonacja' };

function Row({ s }: { s: Sound }) {
  return (
    <Link to={`/dzwieki/${s.id}`} className="focus-ring flex items-center gap-3 py-3">
      <span className="phon grid min-w-12 place-items-center rounded-lg bg-[var(--surface-2)] px-2 py-1 text-sm font-semibold">{s.symbol}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{s.titlePl}</p>
        <p className="text-xs text-[var(--muted)]">{s.summaryPl}</p>
      </div>
      {s.polish === 'advantage' && <Badge tone="ok">przewaga</Badge>}
      {s.polish === 'trap' && <Badge tone="warn">pułapka</Badge>}
      <ChevronRight className="size-4 text-[var(--muted)]" />
    </Link>
  );
}

export default function Sounds() {
  const adv = content.sounds.filter((s) => s.polish === 'advantage');
  const traps = content.sounds.filter((s) => s.polish === 'trap');
  return (
    <div className="space-y-4">
      <PageHeader title="Dźwięki" subtitle="Laboratorium wymowy portugalskiego europejskiego" back="/wiecej" />
      <Notice tone="info">
        Opisy i zapis „Fonetyka PL” to przybliżenie dydaktyczne, przygotowane starannie, ale <strong>jeszcze bez weryfikacji przez native speakera</strong>. Zawsze porównuj z
        nagraniem.
      </Notice>
      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-bold">
          <Sparkles className="size-5 text-laurel-600" /> Twoja przewaga jako Polaka
        </h2>
        <p className="text-sm text-[var(--muted)]">Dźwięki, które znasz z polskiego — podobne, choć nie zawsze identyczne.</p>
        <div className="divide-y divide-[var(--border)]">{adv.map((s) => <Row key={s.id} s={s} />)}</div>
      </Card>
      <Card>
        <h2 className="mb-1 flex items-center gap-2 font-bold">
          <TriangleAlert className="size-5 text-amber-700" /> Najczęstsze pułapki Polaka
        </h2>
        <ul className="mb-2 list-inside list-disc text-sm text-[var(--muted)]">
          <li>czytanie tak, jak się pisze</li>
          <li>pomijanie redukcji samogłosek</li>
          <li>nosówki czytane jak polskie ą/ę</li>
          <li>akcent zawsze na przedostatniej sylabie</li>
          <li>mylenie samogłosek otwartych i zamkniętych</li>
          <li>końcowe l wymawiane jak ł</li>
          <li>jedno r dla wszystkich przypadków</li>
        </ul>
        <div className="divide-y divide-[var(--border)]">{traps.map((s) => <Row key={s.id} s={s} />)}</div>
      </Card>
      {(Object.keys(GROUPS) as Sound['group'][]).map((g) => (
        <Card key={g}>
          <h2 className="font-bold">{GROUPS[g]}</h2>
          <div className="divide-y divide-[var(--border)]">
            {content.sounds.filter((s) => s.group === g).map((s) => (
              <Row key={s.id} s={s} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
