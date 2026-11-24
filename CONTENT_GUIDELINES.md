# CONTENT_GUIDELINES.md — jak tworzyć treści LEVADY

## 1. Pliki i identyfikatory
- `content/items/wNN.json` — elementy językowe (`LearningItem`). ID: krótkie, kebab-case, bez polskich i portugalskich znaków,
  np. `bom-dia`, `chamo-me`, `ser-sou`, `w02-ex-sou-polaco`. **ID są globalne** — przed dodaniem sprawdź, czy element już istnieje, i użyj go ponownie.
- `content/lessons/wNN.json` — lekcje tygodnia (5 lekcji + 1 lekcja/test powtórkowy).
- `content/dialogues/wNN.json`, `content/exercises/wNN.json`, `content/speaking/wNN.json`, `content/tests/wNN.json`.
- Zdania dialogów i przykładów to też `LearningItem` (mają wymowę!). Dialog odwołuje się do nich przez `itemId`.

## 2. Lekcja (10–15 min)
1. **Rozgrzewka** — jeden dźwięk z laboratorium (`warmup.soundId`) + 1–3 słowa.
2. **Nowe słowa** — 5–8 elementów (A0/A1). Każdy: PT, PL, `plSlow`, akcent, audio/TTS.
3. **Prosta zasada** — jedno zagadnienie, po polsku, porównanie z polskim, bez żargonu (a jeśli termin — to wyjaśniony).
4. **Przykłady** — 3–5 krótkich zdań wyłącznie z poznanych słów.
5. **Dialog** — 4–8 kwestii, naturalny PT-PT, tylko poznany materiał (wyjątek: max 1 nowy zwrot, wyjaśniony).
6. **Ćwiczenia** — 6–10, mieszanka: słuchanie, rozpoznawanie, przypominanie, budowanie zdań, przekształcenia.
   Nie tylko klikanie: zawsze co najmniej jedno `recallSay` (mówienie) i jedno `buildSentence`/`transform`.
7. **Mówię samodzielnie** — 3–5 zadań; min. jedno osobiste (`personal`), jeśli dotyczy.
8. **Podsumowanie** — generowane automatycznie (cele, nowe elementy, błędy).

## 3. Progresja
- Każda lekcja buduje na poprzednich (`prerequisites`). Nowe słowo w zdaniu musi być wcześniej wprowadzone
  albo być w `newItemIds` tej lekcji.
- Pierwszy miesiąc: max ~8 nowych elementów na lekcję (nie licząc zdań-przykładów złożonych ze znanych słów).
- Jedna nowa zasada gramatyczna na lekcję. Wiele przykładów.
- Czasowniki: najpierw formy *eu*, potem *o senhor/ele/ela*, potem *tu*, potem liczba mnoga.

## 4. Naturalny PT-PT — checklista
- [ ] Brak brazylijskiego słownictwa (*ônibus, celular, trem, café da manhã, banheiro, geladeira, suco, sorvete, tela*).
- [ ] Brak *estar + gerúndio* jako formy podstawowej (PT-PT: *estar a + bezokolicznik*). Gerúndio dopuszczalne w innych funkcjach — sprawdź kontekst.
- [ ] Zaimki: *chamo-me*, nie *me chamo* na początku zdania.
- [ ] Pisownia PT: *Polónia, económico, registo, contacto, facto, receção*.
- [ ] Forma grzecznościowa odpowiednia do sytuacji (*o senhor/a senhora*, *tu* dla bliskich/dzieci).
- [ ] Prośby z *queria / podia / se faz favor*.
- [ ] *Fato* = garnitur (PT-PT), *facto* = fakt — nie zamieniać automatycznie.

## 5. Kontrola słownictwa i gramatyki
- Przed publikacją: `npm run lint:content` (schematy, referencje, akcent, podejrzane formy BR, brak wymowy).
- Linter wykrywa **podejrzane** konstrukcje — decyzję podejmuje człowiek. Nie usuwać poprawnych form tylko dlatego, że są na liście.
- Gramatyka wprowadzana w zdaniach musi być już omówiona; wyjątki = gotowe zwroty (np. *queria* jako formuła grzecznościowa) z wyjaśnieniem.

## 6. Dialogi i czytanki
- Krótkie, realistyczne, z kontekstem po polsku (`contextPl`). Bez stereotypów.
- Postacie stałe: **Ana** (sąsiadka, Portugalka), **Rui** (barista w kawiarni w Funchal), **Marta** (wychowawczyni w przedszkolu),
  **Tomasz/Tomek** (Polak na Maderze — „ty” w dialogach). Imion polskich nie transkrybujemy.
- **Fakty fabularne (spójne w całym kursie):** Tomek mieszka w Funchal, pracuje z komputerami (czasem z domu albo z kawiarni),
  ma **jednego syna** (5 lat, przedszkole, wychowawczyni Marta); mama i siostra mieszkają w Polsce. Z Aną i Ruim jest po imieniu (*tu*),
  z Martą — formalnie (*o senhor / a senhora*). Przykłady ogólne w liczbie mnogiej (np. *os meus filhos*) oznaczamy w `usagePl` jako ogólne.
- Czytanki: ~95% znanego słownictwa (liczone po lematach, nie po identycznych ciągach znaków).

## 7. Wymowa
- Zgodnie z PRONUNCIATION.md. Każdy nowy element: `plSlow`; zdania: `plNatural`, jeśli różnica jest istotna.
- IPA (`ipa`) dla słów i krótkich zwrotów, gdy autor jest pewny; w razie wątpliwości — pominąć i dodać `notePl`.
- `needsReview: true` i `reviewStatus: "draft"` dla wszystkich nowych pozycji (linter może podnieść do `automatedChecked`).

## 8. Statusy
- Element: `draft` → `automatedChecked` → `humanVerified` (tylko z `verifiedBy`, `verifiedAt`).
- Lekcja: `draft` (ukryta w aplikacji) → `review` (widoczna z etykietą „w weryfikacji”) → `published`.
