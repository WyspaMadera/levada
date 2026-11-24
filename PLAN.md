# PLAN.md — architektura i plan implementacji LEVADY

## 1. Architektura techniczna
- **Frontend-only PWA** (brak obowiązkowego backendu i konta): React 19, TypeScript strict, Vite 8, Tailwind CSS 4,
  własne komponenty UI w stylu shadcn (bez zewnętrznego rejestru), ikony lucide-react, React Router (HashRouter — działa na każdym statycznym hostingu).
- **PWA:** vite-plugin-pwa (Workbox, `generateSW`), manifest, precache aplikacji i treści, cache audio (`CacheFirst`), instalacja na ekranie głównym.
- **Dane użytkownika:** IndexedDB przez Dexie (`src/db/db.ts`), wersjonowane migracje, eksport/import JSON.
- **Treści:** JSON w `content/`, walidowane Zod (`src/content/schema.ts`), ładowane statycznie przez `import.meta.glob` (wchodzą do bundla → offline).
- **Powtórki:** ts-fsrs (FSRS) w `src/lib/srs.ts`; osobne karty dla kompetencji.
- **Audio:** `src/lib/audio.ts` — najpierw nagranie z `content/audio/manifest.json` (jeśli plik istnieje), potem Web Speech API z głosem `pt-PT`.
  Nigdy po cichu `pt-BR`. `scripts/audio-build.ts` — generator nagrań przez skonfigurowanego dostawcę TTS (wymaga klucza w `.env`, nie we frontendzie).
- **Mikrofon:** MediaRecorder (nagrania lokalnie w IndexedDB), opcjonalnie SpeechRecognition `pt-PT` (tylko informacyjnie).
- **AI (etap 5, opcjonalnie):** serwer pośredniczący (np. funkcja serverless) trzymający klucz; frontend wysyła tylko to, na co użytkownik się zgodził.

```
src/
  content/   schema.ts (Zod), load.ts (indeks treści), phonetics.ts (kontrola zapisu), brazil.ts (podejrzane formy BR)
  db/        db.ts (Dexie), repo.ts (operacje), backup.ts (eksport/import)
  lib/       srs.ts, planner.ts, radar.ts, answers.ts, audio.ts, recorder.ts, voices.ts, lessonResult.ts
  components/ PronunciationCard, AudioButton, Recorder, VowelChart, MadeiraMap, ui/*
  screens/   Today, Trail(mapa), LessonPlayer, Review, Sounds, Conversations, Listen(Auto), More, Settings, Progress, Mistakes, Onboarding, Test
scripts/     lint-content.ts, audio-build.ts, build-icons.mjs
content/     items/ lessons/ dialogues/ exercises/ speaking/ tests/ sounds/ map/ curriculum/ audio/ readings/
```

## 2. Model danych (skrót; pełne typy w `src/content/schema.ts` i `src/db/db.ts`)
- **Treść:** `LearningItem` (PT, PL, wymowa: `plSlow/plNatural/ipa/stress/notePl/needsReview`, audio, poziom, region, `reviewStatus`),
  `Lesson` (zgodnie ze specyfikacją + `warmup`, `exampleIds`), `Dialogue`, `Exercise` (unia typów), `SpeakingTask`, `Test`, `Sound`, `MapStop`, `CurriculumWeek`, `AudioManifest`.
- **Użytkownik (IndexedDB):** `settings`, `profile` (życiorys — lokalnie, opcjonalnie), `lessonProgress`, `cards` (FSRS: `itemId × skill`),
  `reviewLogs`, `attempts` (każda odpowiedź w ćwiczeniu), `mistakes` (zeszyt błędów), `speakingLogs`, `recordings` (Blob), `testResults`, `studySessions` (czas nauki).
- **Kompetencje (osobno):** `listening`, `recognition`, `recall`, `building`, `speaking`.

## 3. Ekrany
Dzisiaj · Szlak (mapa Madery) · Rozmowy · Słuchanie (Tryb Auto) · Więcej → Dźwięki, Zeszyt błędów, Postępy, Ustawienia, Sprawdziany,
Moje zdania, Mój życiorys, Ściągawki, Czytanki (te ostatnie — etap 7). Dodatkowo: Onboarding, Odtwarzacz lekcji (8 kroków), Powtórki, Sprawdzian.

## 4. Plan 26 tygodni
Zob. CURRICULUM.md i `content/curriculum/weeks.json`.

## 5. Etapy implementacji i kryteria ukończenia
| Etap | Zakres | Kryterium ukończenia |
|---|---|---|
| 1 Fundament | projekt, PWA, nawigacja, Dzisiaj, onboarding, ustawienia, IndexedDB, eksport/import, mapa | build + PWA manifest + SW; e2e: onboarding → Dzisiaj; eksport/import działa (test jednostkowy) |
| 2 Wymowa | PronunciationCard, laboratorium Dźwięki, TTS pt-PT + wykrywanie, nagrywanie, porównanie, walidacja zapisu | linter wymowy z testami; brak pt-PT → komunikat; nagrywanie działa w Chromium |
| 3 Silnik nauki | lekcje, ćwiczenia, postęp, FSRS, zeszyt błędów, radar, plan dnia, mikrotest | testy jednostkowe planera/radaru/FSRS; e2e: ukończenie lekcji → karty w powtórkach |
| 4 Miesiąc 1 | 24 lekcje tyg. 1–4 (najpierw 12 lekcji tyg. 1–2) + sprawdziany | `lint:content` bez błędów krytycznych; raport niezweryfikowanych wymów; **STOP — prezentacja** |
| 5 Mówienie i AI | scenariusze rozmów, spontaniczne mówienie, opcjonalny trener AI przez proxy | podstawowy trener bez AI; AI tylko po konfiguracji |
| 6 Tryb Auto | odtwarzacz, playlisty, pauzy, Media Session, cache | testy kolejki; dokumentacja ograniczeń iOS/Android |
| 7 Moduły dodatkowe | życiorys, ściągawki, czytanki, podcasty, moje zdania, misje | zweryfikowane źródła, brak zmyślonych procedur |
| 8 Testy i analiza | sprawdziany miesięczne, egzamin końcowy, mapa kompetencji | — |
| 9 Rozbudowa programu | tygodnie 5–26 partiami | każda partia: `lint:content` + przegląd |
| 10 Dopracowanie | a11y, wydajność, bezpieczeństwo, publikacja | raport końcowy |
