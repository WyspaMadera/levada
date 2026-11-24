# CLAUDE.md — stałe reguły projektu LEVADA

LEVADA to PWA do nauki **portugalskiego europejskiego (pt-PT)** od zera (A0) dla dorosłego Polaka mieszkającego na Maderze.
Interfejs, instrukcje i wyjaśnienia — **po polsku**.

## Hierarchia priorytetów (nigdy nie odwracać)
1. Poprawna nauka od zera. 2. Wymowa PT-PT z rzetelnym zapisem dla Polaka. 3. Samodzielne tworzenie zdań i rozmowa.
4. Rozumienie ze słuchu i powtórki (FSRS). 5. Adaptacyjny plan 26 tygodni. 6. Tryb Auto. 7. Czytanki i materiały.
8. Madera, urzędy, przedszkole, rezerwacje. 9. Personalizacja i AI.

## Język treści
- Wyłącznie **pt-PT**: *autocarro, telemóvel, comboio, pequeno-almoço, estou a fazer, chamo-me, percebo, casa de banho, sumo, ecrã*.
- Pisownia wg Porozumienia Ortograficznego 1990 w wariancie portugalskim (*ação, ator, facto, contacto, receção, Polónia, económico*).
- Formy grzecznościowe: *o senhor / a senhora* + 3. osoba; *tu* wśród bliskich; *você* ostrożnie; prośby z *queria, podia, gostaria*.
- Zaimek nieakcentowany zwykle **po** czasowniku (*chamo-me*, *pode ajudar-me*), przed czasownikiem po *não*, pytajnikach itp.
- Regionalizmy Madery tylko z etykietą `region: "madeira"`, z odpowiednikiem standardowym i wiarygodnym źródłem. **Nie wymyślać** regionalizmów ani cech akcentu.
- Brak pewności → status `draft`, `needsReview: true`, uwaga w `notePl`. Nigdy nie udawać weryfikacji.

## Wymowa
- Konwencja: **PRONUNCIATION.md** („Fonetyka PL”). Każdy element do nauki ma `pronunciation.plSlow`; zdania tam, gdzie trzeba, także `plNatural`.
- Nie generować zapisu mechaniczną zamianą liter. Uwzględniać redukcję, akcent, samogłoski otwarte/zamknięte, nosowość, sandhi.
- Statusy: `draft` / `automatedChecked` / `humanVerified`. `humanVerified` **tylko** z `verifiedBy` + `verifiedAt` po realnej weryfikacji.
- Nie zgadywać wymowy imion i nazw własnych użytkownika.

## Przechowywanie treści
- Treści w `content/` (JSON), walidowane schematami Zod z `src/content/schema.ts`.
- Katalogi: `items/`, `lessons/`, `dialogues/`, `exercises/`, `speaking/`, `tests/`, `sounds/`, `map/`, `curriculum/`, `audio/`, `readings/`.
- Poprawki treści nie wymagają zmian kodu. Audio: pliki tylko jeśli fizycznie istnieją i są wpisane w `content/audio/manifest.json`.

## Konwencje programistyczne
- React 19 + TypeScript strict + Vite + Tailwind 4; Dexie (IndexedDB); ts-fsrs; Zod; HashRouter (statyczny hosting).
- Logika czysta (planer, radar, FSRS, ocena odpowiedzi, kontrola wymowy) w `src/lib/` — bez Reacta, z testami Vitest.
- Komponenty w `src/components/`, ekrany w `src/screens/`. Brak niedziałających przycisków: funkcje niedostępne mają jasny komunikat.
- Klucze API nigdy we frontendzie. Integracje AI/TTS przez serwer pośredniczący (opcjonalny).
- Dane lokalnie; eksport/import JSON; migracje Dexie przez `db.version(n)`.

## Testy (przed każdym commitem)
`npm run typecheck && npm run lint && npm run lint:content && npm test && npm run build`, oraz `npm run test:e2e` dla ścieżek krytycznych.
Nie deklarować przetestowania na fizycznym iPhonie/Androidzie bez takiego urządzenia (używamy emulacji viewportu w Chromium).

## Uczciwość
Nie deklarować działań, których nie wykonano. Nie tworzyć fikcyjnych nagrań, wyników, źródeł ani wskaźników „płynności”.
Aktualny stan zawsze w IMPLEMENTATION_STATUS.md.
