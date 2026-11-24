import { useEffect, useState } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import { deleteProfile, getProfile, saveProfile } from '@/db/repo';
import type { Profile as P } from '@/db/db';
import { Button, Card, Notice, PageHeader } from '@/components/ui';

const FIELDS: { key: keyof Omit<P, 'id'>; label: string; hint?: string; multiline?: boolean }[] = [
  { key: 'name', label: 'Imię', hint: 'Używane w zdaniach „Chamo-me …”.' },
  { key: 'country', label: 'Kraj pochodzenia' },
  { key: 'city', label: 'Miasto zamieszkania' },
  { key: 'job', label: 'Zawód' },
  { key: 'interests', label: 'Zainteresowania', multiline: true },
  { key: 'family', label: 'Rodzina (np. „żona i syn”)', multiline: true },
  { key: 'sinceMadeira', label: 'Od kiedy mieszkasz na Maderze' },
  { key: 'childNote', label: 'Informacje o dziecku (całkowicie opcjonalne)', hint: 'Nie są potrzebne do nauki. Wpisz tylko, jeśli chcesz ćwiczyć zdania o dziecku.', multiline: true },
];

export default function Profile() {
  const [p, setP] = useState<P | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void getProfile().then(setP);
  }, []);
  if (!p) return null;
  return (
    <div className="space-y-4">
      <PageHeader title="Moje dane" subtitle="Z tych danych powstają Twoje osobiste zdania" back="/zyciorys" />
      <Notice tone="info">
        <p className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" /> Wszystko jest opcjonalne i zapisane tylko na tym urządzeniu. Nigdzie tego nie wysyłamy — chyba że sam(a) włączysz to w Ustawieniach trenera AI (imię, miasto, praca, zainteresowania; informacji o dziecku nigdy).
        </p>
      </Notice>
      <Card className="space-y-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm font-medium">{f.label}</span>
            {f.multiline ? (
              <textarea
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                rows={2}
                value={p[f.key] ?? ''}
                onChange={(e) => {
                  setSaved(false);
                  setP({ ...p, [f.key]: e.target.value });
                }}
              />
            ) : (
              <input
                className="focus-ring mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                value={p[f.key] ?? ''}
                onChange={(e) => {
                  setSaved(false);
                  setP({ ...p, [f.key]: e.target.value });
                }}
              />
            )}
            {f.hint && <span className="mt-1 block text-xs text-[var(--muted)]">{f.hint}</span>}
          </label>
        ))}
        <Button
          className="w-full"
          onClick={async () => {
            await saveProfile(p);
            setSaved(true);
          }}
        >
          Zapisz
        </Button>
        {saved && <p className="text-center text-sm text-laurel-700 dark:text-laurel-100">Zapisano na tym urządzeniu.</p>}
      </Card>
      <Button
        variant="ghost"
        className="w-full text-coral-600"
        onClick={async () => {
          if (confirm('Usunąć wszystkie dane życiorysu?')) {
            await deleteProfile();
            setP({ id: 'profile' });
          }
        }}
      >
        <Trash2 className="size-4" /> Usuń dane życiorysu
      </Button>
    </div>
  );
}
