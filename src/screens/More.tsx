import { BookOpen, ClipboardCheck, FileAudio, LineChart, ListChecks, NotebookPen, Radio, Settings, Sparkles, User, Waves, Zap, Target, BookText } from 'lucide-react';
import { LinkCard, PageHeader } from '@/components/ui';

export default function More() {
  return (
    <div className="space-y-3">
      <PageHeader title="Więcej" />
      <LinkCard to="/dzwieki" icon={<Waves className="size-5" />} title="Dźwięki" desc="Laboratorium wymowy, pary minimalne, przewagi i pułapki Polaka" />
      <LinkCard to="/postepy" icon={<LineChart className="size-5" />} title="Postępy" desc="Co już umiesz — konkretnie, bez sztucznych wskaźników" />
      <LinkCard to="/bledy" icon={<NotebookPen className="size-5" />} title="Zeszyt błędów" desc="Twoje pomyłki i ich powtórka" />
      <LinkCard to="/sprawdziany" icon={<ClipboardCheck className="size-5" />} title="Sprawdziany" desc="Tygodniowe i etapowe" />
      <LinkCard to="/sciagawki" icon={<ListChecks className="size-5" />} title="Potrzebuję tego dzisiaj" desc="Ściągawki: przedszkole, urzędy, lekarz, sklep, rezerwacje…" />
      <LinkCard to="/czytanki" icon={<BookOpen className="size-5" />} title="Czytam i rozumiem" desc="Czytanki z poznanego słownictwa" />
      <LinkCard to="/sluchaj" icon={<Radio className="size-5" />} title="Słuchaj portugalskiego" desc="Sprawdzone podcasty, YouTube, radio" />
      <LinkCard to="/zyciorys" icon={<User className="size-5" />} title="Mój portugalski życiorys" desc="Wypowiedź o sobie budowana krok po kroku" />
      <LinkCard to="/moje-zdania" icon={<BookText className="size-5" />} title="Moje zdania" desc="Twój zbiór zdań do ćwiczenia" />
      <LinkCard to="/minuta-odwagi" icon={<Zap className="size-5" />} title="Minuta odwagi" desc="60 sekund mówienia bez przygotowania" />
      <LinkCard to="/misje" icon={<Target className="size-5" />} title="Misje w prawdziwym życiu" desc="Użyj zwrotu naprawdę, na Maderze" />
      <LinkCard to="/rozmowy/ai" icon={<Sparkles className="size-5" />} title="Trener rozmów AI (opcjonalnie)" desc="Wymaga własnego serwera pośredniczącego z kluczem API" />
      <LinkCard to="/nagrania" icon={<FileAudio className="size-5" />} title="Moje nagrania" desc="Zapisane próby wymowy" />
      <LinkCard to="/ustawienia" icon={<Settings className="size-5" />} title="Ustawienia" desc="Głos, tempo, motyw, eksport i import danych" />
    </div>
  );
}
