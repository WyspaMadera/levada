import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { content } from '@/content/content';
import type { Exercise } from '@/content/schema';
import { logStudy, recordResult } from '@/db/repo';
import { getItem } from '@/lib/items';
import { PronunciationCard } from '@/components/PronunciationCard';
import { VowelChart } from '@/components/VowelChart';
import { ExerciseView } from '@/components/ExerciseView';
import { Badge, Button, Card, Notice, PageHeader, RichText } from '@/components/ui';

export default function SoundDetail() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const sound = content.soundById.get(id);
  const nav = useNavigate();
  const [drill, setDrill] = useState(params.get('trening') === '1');
  const [di, setDi] = useState(0);
  const started = useRef(Date.now());

  const drillExercises = useMemo<Exercise[]>(() => {
    if (!sound) return [];
    const pairs: Exercise[] = sound.minimalPairs.flatMap(([a, b], i) => [
      { id: `lab-${sound.id}-mp${i}a`, type: 'minimalPair', itemIds: [a, b] } as Exercise,
      { id: `lab-${sound.id}-mp${i}b`, type: 'minimalPair', itemIds: [a, b] } as Exercise,
    ]);
    const ex = sound.exampleItemIds;
    const listen: Exercise[] =
      ex.length >= 2
        ? ex.slice(0, 2).map((t, i) => ({ id: `lab-${sound.id}-l${i}`, type: 'listenChoose', targetItemId: t, optionItemIds: ex.slice(0, 3) }) as Exercise)
        : [];
    const say: Exercise[] = ex.slice(0, 1).map((t) => ({ id: `lab-${sound.id}-s`, type: 'recallSay', targetItemId: t, promptPl: 'Powiedz na głos (zwróć uwagę na ćwiczony dźwięk):' }) as Exercise);
    return [...pairs, ...listen, ...say].slice(0, 5);
  }, [sound]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [drill]);

  if (!sound) return <Notice tone="warn">Nie ma takiego dźwięku.</Notice>;

  if (drill) {
    const ex = drillExercises[di];
    if (!ex) {
      return (
        <div className="space-y-4">
          <PageHeader title={`Trening: ${sound.titlePl}`} back={`/dzwieki/${sound.id}`} />
          <Notice tone="ok">Ćwiczenie wymowy zakończone. Wracaj do tego dźwięku co kilka dni — ucho uczy się stopniowo.</Notice>
          <Button className="w-full" size="lg" onClick={() => nav('/')}>
            Wróć do „Dzisiaj”
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <PageHeader title={`Trening: ${sound.titlePl}`} subtitle={`${di + 1} / ${drillExercises.length}`} back={`/dzwieki/${sound.id}`} />
        <ExerciseView
          key={ex.id + di}
          exercise={ex}
          onAnswered={(o) => {
            void recordResult({ itemId: o.itemId, skill: o.skill, correct: o.correct, self: o.self, context: 'review', exerciseId: ex.id, mistake: o.correct ? undefined : { category: o.skill === 'listening' ? 'listening' : 'pronunciation', expected: o.expected, given: o.given } });
          }}
          onNext={() => {
            if (di + 1 >= drillExercises.length) void logStudy('lab', Math.max(30, (Date.now() - started.current) / 1000));
            setDi(di + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={sound.titlePl} subtitle={sound.summaryPl} back="/dzwieki" />
      <div className="flex flex-wrap gap-2">
        <Badge tone="info">
          zapis: <span className="phon">{sound.symbol}</span>
        </Badge>
        <Badge>IPA: [{sound.ipa}]</Badge>
        {sound.polish === 'advantage' && <Badge tone="ok">przewaga Polaka</Badge>}
        {sound.polish === 'trap' && <Badge tone="warn">pułapka Polaka</Badge>}
        {sound.needsReview && <Badge tone="warn">opis do weryfikacji</Badge>}
      </div>
      <Card>
        <RichText text={sound.explanationPl} />
      </Card>
      <Card className="space-y-2">
        <h2 className="font-bold">Usta i język</h2>
        <p className="text-sm">
          <strong>Usta:</strong> {sound.mouth.lips}
        </p>
        <p className="text-sm">
          <strong>Język:</strong> {sound.mouth.tongue}
        </p>
        {sound.mouth.extraPl && <p className="text-sm">{sound.mouth.extraPl}</p>}
        {sound.vowelChart && <VowelChart highlight={sound.vowelChart} />}
      </Card>
      <Card>
        <h2 className="mb-1 font-bold">W porównaniu z polskim</h2>
        <p className="text-sm">{sound.polishComparisonPl}</p>
      </Card>
      <section className="space-y-2">
        <h2 className="font-bold">Przykłady — posłuchaj, powtórz, nagraj się</h2>
        {sound.exampleItemIds.map((i) => (
          <PronunciationCard key={i} item={getItem(i)} variant="compact" showRecorder />
        ))}
      </section>
      {sound.minimalPairs.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-bold">Pary minimalne</h2>
          <p className="text-sm text-[var(--muted)]">Dwa słowa różniące się jednym dźwiękiem — i znaczeniem.</p>
          {sound.minimalPairs.map(([a, b]) => (
            <div key={a + b} className="grid gap-2 sm:grid-cols-2">
              <PronunciationCard item={getItem(a)} variant="compact" />
              <PronunciationCard item={getItem(b)} variant="compact" />
            </div>
          ))}
        </Card>
      )}
      <Button size="lg" className="w-full" onClick={() => setDrill(true)} disabled={drillExercises.length === 0}>
        Trening (ok. 2 min)
      </Button>
      <Link to="/dzwieki" className="block text-center text-sm underline">
        Wszystkie dźwięki
      </Link>
    </div>
  );
}
