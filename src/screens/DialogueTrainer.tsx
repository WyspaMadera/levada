import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Eye } from 'lucide-react';
import { content } from '@/content/content';
import type { ConversationTurnLog, SelfRating } from '@/db/db';
import { logStudy, saveConversation } from '@/db/repo';
import { getItem, itemView } from '@/lib/items';
import { ratingSummary, recordSpokenAnswer } from '@/lib/conversationResult';
import { useApp } from '@/state/AppContext';
import { AudioButton } from '@/components/Audio';
import { AnswerAttempt } from '@/components/AnswerAttempt';
import { Button, Card, Notice, PageHeader } from '@/components/ui';

/** Dialog z lekcji: kwestie rozmówcy słyszysz, swoje mówisz sam(a). */
export default function DialogueTrainer() {
  const { id = '' } = useParams();
  const dialogue = content.dialogues.get(id);
  const { settings } = useApp();
  const nav = useNavigate();
  const [i, setI] = useState(0);
  const [showOther, setShowOther] = useState(false);
  const [ratings, setRatings] = useState<SelfRating[]>([]);
  const started = useRef(Date.now());
  const spoke = useRef(0);
  const turns = useRef<ConversationTurnLog[]>([]);
  const saved = useRef(false);
  const line = dialogue?.lines[i];

  useEffect(() => {
    if (dialogue && !line && !saved.current) {
      saved.current = true;
      const seconds = (Date.now() - started.current) / 1000;
      void saveConversation({ kind: 'dialogue', refId: dialogue.id, level: dialogue.level, turns: turns.current, seconds, speakingSeconds: spoke.current });
      void logStudy('conversation', seconds, spoke.current);
    }
  }, [line, dialogue]);

  if (!dialogue) return <Notice tone="warn">Nie ma takiego dialogu.</Notice>;
  if (!line) {
    const r = ratingSummary(ratings);
    return (
      <div className="space-y-4">
        <PageHeader title={dialogue.titlePl} back="/rozmowy" />
        <Notice tone="ok">
          Rozmowa zakończona. Umiem: {r.can} · Prawie: {r.almost} · Nie umiem: {r.cannot}.
        </Notice>
        <Button className="w-full" onClick={() => nav('/rozmowy')}>
          Wróć do rozmów
        </Button>
      </div>
    );
  }
  const it = getItem(line.itemId);
  const fem = line.fem ?? (line.isLearner ? settings.gender === 'f' : false);
  const v = itemView(it, settings.gender, fem);
  const next = () => {
    setShowOther(false);
    setI(i + 1);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={dialogue.titlePl} subtitle={`Kwestia ${i + 1} z ${dialogue.lines.length}`} back="/rozmowy" />
      {i === 0 && <p className="text-sm text-[var(--muted)]">{dialogue.contextPl}</p>}
      {!line.isLearner ? (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-[var(--muted)]">{line.speaker} mówi:</p>
          <div className="flex items-center gap-3">
            <AudioButton item={it} fem={v.fem} size="lg" repeat={1} />
            {showOther ? (
              <div>
                <p className="text-lg font-semibold" lang="pt-PT">{v.pt}</p>
                <p className="text-sm text-[var(--muted)]">{v.pl}</p>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setShowOther(true)}>
                <Eye className="size-4" /> Pokaż tekst
              </Button>
            )}
          </div>
          <Button className="w-full" onClick={next}>
            Dalej
          </Button>
        </Card>
      ) : (
        <Card>
          <AnswerAttempt
            key={i}
            taskPl={`Twoja kolej. Znaczenie: „${v.pl}”`}
            answerItemIds={[it.id]}
            revealLabel="Pokaż wzór"
            onRated={({ self, seconds, recognized }) => {
              spoke.current += seconds;
              setRatings((r) => [...r, self]);
              turns.current.push({ speaker: 'learner', itemId: it.id, self, text: recognized });
              void recordSpokenAnswer({ answerItemIds: [it.id], self, seconds, context: 'conversation', exerciseId: `dialogue-${dialogue.id}-${i}` });
              next();
            }}
          />
        </Card>
      )}
    </div>
  );
}
