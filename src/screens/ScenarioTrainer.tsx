import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Eye } from 'lucide-react';
import { content } from '@/content/content';
import type { ConversationTurnLog, SelfRating } from '@/db/db';
import { logStudy, saveConversation } from '@/db/repo';
import { getItem, itemView } from '@/lib/items';
import { ratingSummary, recordSpokenAnswer } from '@/lib/conversationResult';
import { useApp } from '@/state/AppContext';
import { AudioButton, useAudioAvailable, usePlayer } from '@/components/Audio';
import { AnswerAttempt } from '@/components/AnswerAttempt';
import { Phon } from '@/components/Phon';
import { Button, Card, Notice, PageHeader, ProgressBar } from '@/components/ui';

export default function ScenarioTrainer() {
  const { id = '' } = useParams();
  const sc = content.scenarios.find((s) => s.id === id);
  const { settings } = useApp();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const [showText, setShowText] = useState(false);
  const [ratings, setRatings] = useState<SelfRating[]>([]);
  const turnsLog = useRef<ConversationTurnLog[]>([]);
  const started = useRef(Date.now());
  const spoke = useRef(0);
  const saved = useRef(false);
  const { play } = usePlayer();
  const turn = sc?.turns[i];
  const promptItem = turn ? getItem(turn.promptItemId) : undefined;
  const { available } = useAudioAvailable(promptItem);

  // kwestia rozmówcy odtwarza się sama (jeśli jest głos/nagranie)
  useEffect(() => {
    if (promptItem && available && settings.autoPlayAudio) void play(promptItem, { fem: turn?.promptFem, repeat: 1 });
    setShowText(!available);
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sc && i >= sc.turns.length && !saved.current) {
      saved.current = true;
      const seconds = (Date.now() - started.current) / 1000;
      void saveConversation({ kind: 'scenario', refId: sc.id, level: sc.level, turns: turnsLog.current, seconds, speakingSeconds: spoke.current });
      void logStudy('conversation', seconds, spoke.current);
    }
  }, [i, sc]);

  if (!sc) return <Notice tone="warn">Nie ma takiego scenariusza.</Notice>;

  if (!turn || !promptItem) {
    const r = ratingSummary(ratings);
    return (
      <div className="space-y-4" data-testid="scenario-done">
        <PageHeader title={sc.titlePl} back="/rozmowy" />
        <Notice tone="ok" title="Rozmowa zakończona">
          Umiem: {r.can} · Prawie: {r.almost} · Nie umiem: {r.cannot}. Wypowiedzi trafiły do powtórek mówienia{r.cannot ? ', a trudne — do zeszytu błędów' : ''}.
        </Notice>
        <div className="grid gap-2">
          <Button
            onClick={() => {
              saved.current = false;
              turnsLog.current = [];
              started.current = Date.now();
              spoke.current = 0;
              setRatings([]);
              setI(0);
            }}
          >
            Jeszcze raz (spróbuj innych wariantów)
          </Button>
          <Button variant="secondary" onClick={() => nav('/rozmowy')}>
            Inne rozmowy
          </Button>
        </div>
      </div>
    );
  }
  const pv = itemView(promptItem, settings.gender, turn.promptFem);

  return (
    <div className="space-y-4" data-testid="scenario">
      <PageHeader title={sc.titlePl} subtitle={`${sc.topicPl} · wymiana ${i + 1} z ${sc.turns.length}`} back="/rozmowy" />
      <ProgressBar value={i / sc.turns.length} label="Postęp rozmowy" />
      {i === 0 && <p className="text-sm text-[var(--muted)]">{sc.contextPl}</p>}
      <Card className="space-y-2">
        <p className="text-sm font-semibold text-[var(--muted)]">{turn.speaker} mówi:</p>
        <div className="flex items-center gap-3">
          <AudioButton item={promptItem} fem={pv.fem} size="lg" repeat={1} />
          {showText ? (
            <div>
              <p className="text-lg font-semibold" lang="pt-PT">{pv.pt}</p>
              {pv.pron.plSlow && <Phon text={pv.pron.plSlow} size="sm" className="text-[var(--muted)]" />}
              <p className="text-sm text-[var(--muted)]">{pv.pl}</p>
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setShowText(true)}>
              <Eye className="size-4" /> Pokaż tekst
            </Button>
          )}
        </div>
      </Card>
      <Card>
        <AnswerAttempt
          key={i}
          taskPl={`Twoja kolej: ${turn.taskPl}`}
          answerItemIds={turn.answerItemIds}
          personal={turn.personal}
          onRated={({ self, seconds, recognized }) => {
            spoke.current += seconds;
            setRatings((r) => [...r, self]);
            turnsLog.current.push({ speaker: 'other', itemId: turn.promptItemId }, { speaker: 'learner', itemId: turn.answerItemIds[0], self, text: recognized });
            void recordSpokenAnswer({ answerItemIds: turn.answerItemIds, self, seconds, context: 'conversation', exerciseId: `scenario-${sc.id}-${i}` });
            setI(i + 1);
          }}
        />
      </Card>
      <Link to="/rozmowy" className="block text-center text-sm underline text-[var(--muted)]">
        Przerwij rozmowę
      </Link>
    </div>
  );
}
