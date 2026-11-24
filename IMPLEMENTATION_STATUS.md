# IMPLEMENTATION_STATUS.md — rzeczywisty stan implementacji

Ostatnia aktualizacja: 2026-11-24 · Zakres: **etapy 1–8 + etap 9 partie 1–2 (miesiące 2–3)** (etapy 5–9 dodane po akceptacji użytkownika).

## Działa (zaimplementowane i przetestowane automatycznie)

### Etap 1 — Fundament
- [x] Projekt React 19 + TS strict + Vite 8 + Tailwind 4; własne komponenty UI; HashRouter.
- [x] PWA: manifest, ikony (192/512/maskable), Service Worker (precache 34 plików); **sprawdzone: przeładowanie offline w Chromium działa**.
- [x] Nawigacja 5 zakładek (Dzisiaj, Szlak, Rozmowy, Słuchanie, Więcej) + ekrany pełnoekranowe (lekcja, powtórki, sprawdzian).
- [x] Onboarding (forma m/ż, opcjonalne imię, czas dzienny, test głosu, informacja o mikrofonie).
- [x] Ekran „Dzisiaj”: tydzień i przystanek, wybór „dziś mam 5/15/30 min”, plan dnia, „Rozpocznij dzisiejszą naukę”, skróty do mówienia / Trybu Auto / Dźwięków.
- [x] Ustawienia: głos pt-PT, tempo 0,75/1,0/1,15, powtórzenia 1–3×, motyw jasny/ciemny/systemowy, IPA, ukrywanie wymowy.
- [x] IndexedDB (Dexie, schemat v1 z mechanizmem migracji), eksport/import JSON (z walidacją, przywracaniem dat), usuwanie nagrań i wszystkich danych.
- [x] Mapa Madery: oryginalna stylizowana grafika SVG, 10 przystanków, statusy (ukończone / teraz / warto powtórzyć / przed Tobą), ciekawostki, lista tygodni; „Kontynuuj” nad mapą.

### Etap 2 — Wymowa
- [x] Konwencja „Fonetyka PL” (PRONUNCIATION.md) + komponent `PronunciationCard` (PT · PL · wymowa z wyróżnionym akcentem · audio normalne i wolne · IPA · opis akcentu · wersja naturalna · uwaga · status weryfikacji · nagrywanie).
- [x] Audio: nagrania z manifestu (gdy istnieją) → Web Speech API z głosem **pt-PT**; nigdy cichy pt-BR (pt-BR tylko po świadomej zgodzie, ze znacznikiem „BR”); instrukcje dodania głosu dla Android/iOS/Windows/macOS.
- [x] Nagrywanie własnego głosu (MediaRecorder), odsłuch, zapis lokalny, lista nagrań, usuwanie.
- [x] Laboratorium „Dźwięki”: 19 tematów, usta/język, schemat samogłosek PT-PT vs PL, pary minimalne (avó/avô, pode/pôde, pé/pê, lá/lã, mau/mão, mal/mau, caro/carro, fila/filha, sono/sonho, caça/casa, esta/está, mas/mais), „Twoja przewaga jako Polaka”, „Najczęstsze pułapki”, trening 2-minutowy.
- [x] Automatyczna kontrola zapisu (`src/content/phonetics.ts`): dozwolone znaki, dokładnie jedna sylaba akcentowana, pozycja akcentu vs reguły pisowni, nosowość, lh/nh/ch/rr/ɫ/j, łączenie s→z i s→ż; wykrywanie podejrzanych form pt-BR (`src/content/brazil.ts`) z mechanizmem świadomych wyjątków (`lintAllow`).

### Etap 3 — Silnik nauki
- [x] Odtwarzacz lekcji 8 kroków (rozgrzewka, nowe słowa, zasada + tabela z wymową, przykłady, dialog z odtwarzaniem całości, ćwiczenia, „Mówię samodzielnie”, podsumowanie); wznowienie od zapisanego kroku.
- [x] 9 typów ćwiczeń: słuchanie, para minimalna, rozpoznawanie, przypominanie (wybór / pisanie z tolerancją akcentów i literówek / mówienie z samooceną), układanie zdań, przekształcenia „Jedno zdanie — wiele możliwości”, luki z wyjaśnieniami błędów.
- [x] FSRS (ts-fsrs) osobno dla 5 kompetencji: słuchanie, rozpoznawanie, przypominanie, budowanie zdań, mówienie. Lekcja liczy się jako ukończona dopiero po ćwiczeniach i podsumowaniu.
- [x] Powtórki z dynamicznie generowanymi zadaniami, tryb „tylko mówienie”, tryb „przećwicz błędy”.
- [x] Zeszyt błędów (kategorie: ser/estar, odmiana, rodzaj, grzeczność, słuchanie…; zamknięcie po 2 poprawnych odpowiedziach).
- [x] Radar słabości (reguły z CURRICULUM.md: zaległości, powrót po przerwie bez kar, słabe słuchanie, „rozpoznaję, ale nie mówię”, słaba lekcja, ser/estar, odmiana) i plan dnia 5/15/30 min.
- [x] Sprawdziany (tygodniowe i etapowy): sekcje wg kompetencji, mówienie jako samoocena (wyraźnie oznaczone), rekomendacje lekcji do powtórki, brak blokady.
- [x] Postępy: realne liczby (poznane / aktywnie opanowane wg zdefiniowanego kryterium, czas nauki, minuty mówienia, wyniki testów, kompetencje z 14 dni tylko przy ≥ 8 próbach, lista „co potrafisz”).

### Etap 4 — Pierwszy miesiąc kursu
- [x] **24 lekcje tygodni 1–4** (w tym 12 obowiązkowych lekcji tygodni 1–2), 461 elementów językowych, 24 dialogi, 310 ćwiczeń, 97 zadań mówienia, 4 sprawdziany (3 tygodniowe + etapowy miesiąca).
- [x] `npm run lint:content`: **0 błędów krytycznych, 0 ostrzeżeń**, 15 informacji o progresji (świadome: imiona, zdanie „za szybko” w lekcji 5, formy objaśnione w gramatyce).
- [x] Wszystkie elementy: `reviewStatus: draft`, `needsReview: true`. Lekcje: status `review` (widoczne z etykietą „w weryfikacji”).

### Etap 5 — Mówienie i AI
- [x] **Scenariusze rozmów z wariantami odpowiedzi** (`content/conversations/scenarios.json`, 10 scenariuszy A0–A1: kawiarnia, sąsiadka, „za szybko!”, nowy znajomy, telefon, zakupy i ceny, dane w przedszkolu, gdzie jest telefon, umawianie na plażę, rodzina). Odblokowywane po lekcjach; zadania osobiste z danymi z życiorysu (bez zgadywania wymowy imion).
- [x] **Pytania bez scenariusza** (`content/questions/questions.json`, 15 pytań): spontaniczne odpowiedzi o sobie, podpowiedzi słów, przykładowe odpowiedzi; najpierw najrzadziej ćwiczone. Plan dnia (5/30 min) kieruje „pytania ustne” właśnie tutaj.
- [x] Dialogi z lekcji jako trening własnych kwestii.
- [x] Wspólny blok odpowiedzi: próba na głos → opcjonalne nagranie → opcjonalne rozpoznanie mowy pt-PT (wyraźnie „orientacyjne, nie ocena wymowy”) → warianty z wymową → samoocena.
- [x] **Opcjonalny trener AI**: serwer pośredniczący `server/ai-proxy.ts` (klucz API tylko na serwerze; Claude Opus 5.5, structured outputs, effort `low`, automatyczny fallback po odmowie; CORS, token, limit zapytań, limit rozmiaru, brak logowania treści; tryb testowy `AI_MOCK=1`). W aplikacji: ekran zgody, osobna zgoda na dane z życiorysu (domyślnie wyłączona, dane o dziecku nigdy), kontekst poziomu (umiejętności z ukończonych lekcji + znane słowa), limity długości wg poziomu (A0: 2–3 wymiany), tłumaczenie i nowe słowa po polsku, podsumowanie najważniejszych błędów, etykieta „AI — niezweryfikowane”, AI nie generuje zapisu wymowy.
- [x] Zapis wyników: nowa tabela `conversationLogs` (**migracja IndexedDB v1 → v2**, test), wyniki mówienia aktualizują karty FSRS „mówienie”, „nie umiem” i błędy z podsumowania AI trafiają do zeszytu błędów (AI z oznaczeniem), próby zasilają radar słabości.
- [x] Granica błędów: awaria jednego ekranu nie wyłącza aplikacji.
- [ ] **Trener AI nie był uruchomiony z prawdziwym API** (brak klucza w tym środowisku) — przetestowany end-to-end z serwerem w trybie testowym.

### Etap 7 — Moduły dodatkowe
- [x] **Ściągawki „Potrzebuję tego dzisiaj”**: 14 ściągawek (przedszkole, transport/prawo jazdy, Segurança Social, turystyka, rezerwacje online, lekarz, apteka, warsztat, restauracja, sklep, poczta, sąsiedzi, transport, telefon), 117 nowych zwrotów (draft, z wymową), oznaczenie „trudniejsze”, tryb powiększenia do pokazania rozmówcy, dostępne bez względu na postęp. Bez opisów procedur.
- [x] Instytucje w ściągawkach: ISSM IP-RAM, IMT IP-RAM, SESARAM — **sprawdzone tylko w wynikach wyszukiwarki** (środowisko blokowało otwieranie stron); aplikacja pokazuje to wprost. Rejestracja najmu turystycznego (AL) na Maderze — źródła sprzeczne, celowo bez instytucji.
- [x] **Biblioteka „Słuchaj portugalskiego”**: 10 źródeł (podcasty, YouTube, radio RTP Antena 1 Madeira, narzędzia), filtr poziomu, koszt (bezpłatne / część płatna / nieustalone), wariant, transkrypcja; weryfikacja: wyszukiwarka.
- [x] **Mój życiorys**: 8 sekcji (przedstawiam się, skąd, gdzie mieszkam, wiek, języki, rodzina — opcjonalnie, samopoczucie, plany), odblokowywane z postępem, zweryfikowane wzory zdań z Twoimi danymi (bez zgadywania wymowy nazw), nagrania kolejnych wersji każdej sekcji do porównania.
- [x] **Moje zdania**: gwiazdka przy każdej karcie (lekcje, ściągawki, czytanki), własne zdania (bez zapisu wymowy, z ostrzeżeniem o formach pt-BR), ćwiczenie na głos z FSRS.
- [x] **Minuta odwagi**: 60 s mówienia na odblokowany temat, nagranie, samoocena, historia do porównań.
- [x] **Misje w prawdziwym życiu**: 10 zadań odblokowywane z lekcjami, zapis wykonania i notatki.
- [x] **Czytanki**: 8 tekstów dla tygodni 1–4 (95–100% znanych słów wg szacunku, każde nowe słowo w słowniczku), ekran z „dotknij słowa” (słowniczek + słownik słów z kursu), odsłuch zdań i całości, wymowa/tłumaczenie na żądanie, pytania sprawdzające, szacunek znanych słów liczony z formami (opisany jako szacunek).
- [x] IndexedDB v3 (myPhrases, missionLogs).
- [x] „Ciemne l” (ɫ) rysowane jako „l” z tyldą nad literą — w pogrubionej czcionce wyglądało jak polskie „Ł”.
- Treść łącznie: 639 elementów językowych (wszystkie draft, needsReview).

### Etap 8 — Testy i analiza postępów
- [x] Silnik sprawdzianów rozszerzony o **monolog na czas** (nagranie + lista kontrolna do samooceny, nagranie zapisane do porównań) i **symulacje rozmów** (scenariusze). Wyniki mówienia pokazywane osobno, jako samoocena — nie wchodzą do wyniku procentowego.
- [x] **Sprawdzian miesiąca 1** (etapowy, w04-test): ćwiczenia + symulacja „Umawiamy się na plażę” + 4 zadania ustne + monolog „Opowiedz o sobie” (ok. 60 s, 8 punktów planu); po wyniku link do mapy kompetencji. Nie blokuje dalszej nauki.
- [x] **Mapa kompetencji** (`content/competences/areas.json`, 11 obszarów): statusy „przed Tobą / poznane / w trakcie utrwalania / umiesz” wyliczane z dowodów (ukończone lekcje, zwroty przywołane samodzielnie 2+ razy w powtórkach, otwarte błędy) — bez procentów płynności i bez ocen CEFR; rekomendacje „Przećwicz”.
- [x] **Analiza trudności** w „Postępach”: błędy wg rodzaju (14 dni vs poprzednie 14), najtrudniejsze zwroty (najczęściej zapominane), tabela 4 tygodni (minuty, trafność słuchania / mówienia / przypominania).
- [ ] **Egzamin końcowy (Porto Santo, tydzień 26)** — silnik gotowy (monolog 2–3 min, symulacje), treść powstanie razem z tygodniami 25–26 (nie tworzymy go z materiału, którego kurs jeszcze nie uczy). Sprawdziany miesięcy 2–6 — razem z treścią tych miesięcy.

### Etap 9 — Rozbudowa programu (partiami)
- [x] **Partia 1: miesiąc 2 (tygodnie 5–8)** — 24 lekcje: czasowniki regularne i dzień codzienny (estar a + bezokolicznik), opis osób, dom i rodzina, kawiarnia i zakupy (ceny, ilości, kuchnia Madery jako zwykłe rzeczowniki z krótką notą), miasto, kierunki, autobus, pogoda i pory roku; 416 nowych elementów (draft); sprawdziany tygodniowe w05–w07 i **sprawdzian etapowy A1 (w08-test)** z monologiem 90 s i symulacją; 12 pytań otwartych, 5 scenariuszy; 5 nowych obszarów kompetencji. Każda partia: `lint:content` 0/0 + dodatkowa kontrola, że każde słowo w ćwiczeniach/testach/rozmowach zostało wprowadzone wcześniej.
- [x] **Partia 2: miesiąc 3 (tygodnie 9–12)** — 24 lekcje: czasowniki nieregularne (fazer, sair, vir, ver, dizer, dar), praca i codzienność, plany (ir + bezokolicznik, propozycje, odmowy), **pretérito perfeito** (regularne + fui/estive/tive/fiz; *falamos* vs *falámos*), umawianie wizyt, rezerwacje, telefon, dyktowanie numeru i literowanie; 458 nowych elementów (draft); w09–w11 tygodniowe i **sprawdzian etapowy miesiąca 3 (w12-test)**; 11 pytań otwartych, 5 scenariuszy; obszary kompetencji „Opowiadam o przeszłości” i „Umawianie się, rezerwacje, telefon”.
- [ ] Partie 3–6 (tygodnie 13–26) — kolejno.
- [x] Treść kursu w osobnym pliku paczki (kod 77 KB, biblioteki 473 KB, treść 733 KB) — aktualizacje kodu nie wymagają ponownego pobierania treści.
- [x] Arkusz weryfikacji dla native speakera (`npm run review:export` / `review:apply`).
- Treść łącznie: patrz `npm run lint:content` (po miesiącu 3: 72 lekcje; wszystko draft — bez weryfikacji przez człowieka).

### Wersje podstawowe modułów z późniejszych etapów (działające, ale niepełne)
### Etap 6 — Tryb Auto
- [x] Sesje: Powtórka dnia, **Lekcja na słuch** (wybór lekcji), Dialogi tygodnia, Najtrudniejsze zwroty, zapisana playlista; długości 5/10/20/30 min.
- [x] Schemat PL → pauza na odpowiedź → PT → pauza → PT; podpowiedzi PL: zawsze / **tylko trudne** (wg karty przypominania FSRS) / co drugi / bez.
- [x] **Budowanie długich zdań od końca** (5+ słów: fragment → dłuższy fragment → całość).
- [x] Odtwarzacz: duży przycisk, pauza i **wznawianie od zapamiętanego miejsca** (także po odświeżeniu, 12 h), poprzedni/następny element, tempo 0,75/1/1,15×, kolejka, pasek postępu, Media Session (play/pause/stop/next/previous).
- [x] **„Przygotuj playlistę na jutro”**: zapis zestawu (powtórki na jutro, a gdy brak — bieżący wybór) i pobranie istniejących nagrań do pamięci offline.
- [x] Testy: generator (jednostkowe), odtwarzanie z podstawionym silnikiem TTS pt-PT/pl-PL (e2e: kolejność PL→PT, pauza, następny, wznowienie po odświeżeniu, playlista).
- [ ] Sesje „Mój życiorys”, „Ściągawka sytuacyjna”, „Krótki podcast” — zależą od etapu 7 i nagrań.
- [ ] Odtwarzanie przy zablokowanym ekranie **niegwarantowane** (TTS przeglądarki); nie testowano na fizycznych urządzeniach.

### Etap 7 — Moduły dodatkowe
- [x] **Ściągawki „Potrzebuję tego dzisiaj”**: 14 ściągawek (przedszkole, transport/prawo jazdy, Segurança Social, turystyka, rezerwacje online, lekarz, apteka, warsztat, restauracja, sklep, poczta, sąsiedzi, transport, telefon), 117 nowych zwrotów (draft, z wymową), oznaczenie „trudniejsze”, tryb powiększenia do pokazania rozmówcy, dostępne bez względu na postęp. Bez opisów procedur.
- [x] Instytucje w ściągawkach: ISSM IP-RAM, IMT IP-RAM, SESARAM — **sprawdzone tylko w wynikach wyszukiwarki** (środowisko blokowało otwieranie stron); aplikacja pokazuje to wprost. Rejestracja najmu turystycznego (AL) na Maderze — źródła sprzeczne, celowo bez instytucji.
- [x] **Biblioteka „Słuchaj portugalskiego”**: 10 źródeł (podcasty, YouTube, radio RTP Antena 1 Madeira, narzędzia), filtr poziomu, koszt (bezpłatne / część płatna / nieustalone), wariant, transkrypcja; weryfikacja: wyszukiwarka.
- [x] **Mój życiorys**: 8 sekcji (przedstawiam się, skąd, gdzie mieszkam, wiek, języki, rodzina — opcjonalnie, samopoczucie, plany), odblokowywane z postępem, zweryfikowane wzory zdań z Twoimi danymi (bez zgadywania wymowy nazw), nagrania kolejnych wersji każdej sekcji do porównania.
- [x] **Moje zdania**: gwiazdka przy każdej karcie (lekcje, ściągawki, czytanki), własne zdania (bez zapisu wymowy, z ostrzeżeniem o formach pt-BR), ćwiczenie na głos z FSRS.
- [x] **Minuta odwagi**: 60 s mówienia na odblokowany temat, nagranie, samoocena, historia do porównań.
- [x] **Misje w prawdziwym życiu**: 10 zadań odblokowywane z lekcjami, zapis wykonania i notatki.
- [x] **Czytanki**: 8 tekstów dla tygodni 1–4 (95–100% znanych słów wg szacunku, każde nowe słowo w słowniczku), ekran z „dotknij słowa” (słowniczek + słownik słów z kursu), odsłuch zdań i całości, wymowa/tłumaczenie na żądanie, pytania sprawdzające, szacunek znanych słów liczony z formami (opisany jako szacunek).
- [x] IndexedDB v3 (myPhrases, missionLogs).
- [x] „Ciemne l” (ɫ) rysowane jako „l” z tyldą nad literą — w pogrubionej czcionce wyglądało jak polskie „Ł”.
- Treść łącznie: 639 elementów językowych (wszystkie draft, needsReview).

### Etap 8 — Testy i analiza postępów
- [x] Silnik sprawdzianów rozszerzony o **monolog na czas** (nagranie + lista kontrolna do samooceny, nagranie zapisane do porównań) i **symulacje rozmów** (scenariusze). Wyniki mówienia pokazywane osobno, jako samoocena — nie wchodzą do wyniku procentowego.
- [x] **Sprawdzian miesiąca 1** (etapowy, w04-test): ćwiczenia + symulacja „Umawiamy się na plażę” + 4 zadania ustne + monolog „Opowiedz o sobie” (ok. 60 s, 8 punktów planu); po wyniku link do mapy kompetencji. Nie blokuje dalszej nauki.
- [x] **Mapa kompetencji** (`content/competences/areas.json`, 11 obszarów): statusy „przed Tobą / poznane / w trakcie utrwalania / umiesz” wyliczane z dowodów (ukończone lekcje, zwroty przywołane samodzielnie 2+ razy w powtórkach, otwarte błędy) — bez procentów płynności i bez ocen CEFR; rekomendacje „Przećwicz”.
- [x] **Analiza trudności** w „Postępach”: błędy wg rodzaju (14 dni vs poprzednie 14), najtrudniejsze zwroty (najczęściej zapominane), tabela 4 tygodni (minuty, trafność słuchania / mówienia / przypominania).
- [ ] **Egzamin końcowy (Porto Santo, tydzień 26)** — silnik gotowy (monolog 2–3 min, symulacje), treść powstanie razem z tygodniami 25–26 (nie tworzymy go z materiału, którego kurs jeszcze nie uczy). Sprawdziany miesięcy 2–6 — razem z treścią tych miesięcy.

### Etap 9 — Rozbudowa programu (partiami)
- [x] **Partia 1: miesiąc 2 (tygodnie 5–8)** — 24 lekcje: czasowniki regularne i dzień codzienny (estar a + bezokolicznik), opis osób, dom i rodzina, kawiarnia i zakupy (ceny, ilości, kuchnia Madery jako zwykłe rzeczowniki z krótką notą), miasto, kierunki, autobus, pogoda i pory roku; 416 nowych elementów (draft); sprawdziany tygodniowe w05–w07 i **sprawdzian etapowy A1 (w08-test)** z monologiem 90 s i symulacją; 12 pytań otwartych, 5 scenariuszy; 5 nowych obszarów kompetencji. Każda partia: `lint:content` 0/0 + dodatkowa kontrola, że każde słowo w ćwiczeniach/testach/rozmowach zostało wprowadzone wcześniej.
- [x] **Partia 2: miesiąc 3 (tygodnie 9–12)** — 24 lekcje: czasowniki nieregularne (fazer, sair, vir, ver, dizer, dar), praca i codzienność, plany (ir + bezokolicznik, propozycje, odmowy), **pretérito perfeito** (regularne + fui/estive/tive/fiz; *falamos* vs *falámos*), umawianie wizyt, rezerwacje, telefon, dyktowanie numeru i literowanie; 458 nowych elementów (draft); w09–w11 tygodniowe i **sprawdzian etapowy miesiąca 3 (w12-test)**; 11 pytań otwartych, 5 scenariuszy; obszary kompetencji „Opowiadam o przeszłości” i „Umawianie się, rezerwacje, telefon”.
- [ ] Partie 3–6 (tygodnie 13–26) — kolejno.
- [x] Treść kursu w osobnym pliku paczki (kod 77 KB, biblioteki 473 KB, treść 733 KB) — aktualizacje kodu nie wymagają ponownego pobierania treści.
- [x] Arkusz weryfikacji dla native speakera (`npm run review:export` / `review:apply`).
- Treść łącznie: patrz `npm run lint:content` (po miesiącu 3: 72 lekcje; wszystko draft — bez weryfikacji przez człowieka).

### Wersje podstawowe modułów z późniejszych etapów (działające, ale niepełne)
- [~] Mój życiorys (etap 7): formularz danych lokalnych używanych w zadaniach osobistych (imię, miasto). Brak budowania 2–3-minutowej wypowiedzi.

## Brakujące / w przygotowaniu (w aplikacji jasno oznaczone)
- Trener AI: test z prawdziwym kluczem API; rozmowa głosowa (jest tylko dyktowanie przez rozpoznawanie mowy przeglądarki).
- Pliki audio lektora/TTS — skrypt `npm run audio:build` gotowy (Azure / Google), **nie uruchomiony z prawdziwym dostawcą** (brak klucza). Obecnie 0 nagrań.
- Ściągawki, czytanki, biblioteka podcastów/YouTube (wymaga weryfikacji źródeł online), Moje zdania, Minuta odwagi, Misje (etap 7).
- Egzamin końcowy, mapa kompetencji (etap 8). Tygodnie 5–26 (etap 9).
- Weryfikacja treści przez native speakera / fonetyka — **nie przeprowadzona**.

## Testy (ostatnie uruchomienie)
| Kontrola | Wynik |
|---|---|
| `npm run typecheck` | OK |
| `npm run lint` | OK (0 błędów) |
| `npm run lint:content` | 0 krytycznych, 0 ostrzeżeń, 15 info |
| `npm test` (Vitest) | 78/78 |
| `npm run build` | OK (ostrzeżenie: główny chunk ~520 kB, bo zawiera całą treść — do podziału przy rozbudowie) |
| `npm run test:e2e` (Playwright, Chromium, viewport 360×740) | 15/15: sprawdzian miesiąca z symulacją i monologiem → mapa kompetencji → analiza; brak poziomego przewijania na 20 ekranach; ściągawka (powiększenie) → Moje zdania → ćwiczenie; Minuta odwagi; misja; czytanka (dotknij słowa, pytanie); biblioteka i życiorys; Tryb Auto z podstawionym TTS (PL→PT, pauza, wznowienie, playlista); odsłuch w lekcji używa głosu pt-PT; scenariusz z wariantami + pytania otwarte + zeszyt błędów; trener AI przez serwer w trybie mock (konfiguracja, zgoda, rozmowa, podsumowanie); pełna ścieżka onboarding → lekcja 1 → powtórki → mapa → eksport/import; onboarding bez imienia; brak głosu pt-PT; tryb 5 min; brak poziomego przewijania na 10 ekranach; sprawdzian |
| Offline (Service Worker) | sprawdzone ręcznie skryptem: przeładowanie bez sieci renderuje aplikację |

Błędy znalezione i naprawione dzięki testom: przejście między lekcjami/scenariuszami nie resetowało stanu ekranu (dotyczyło też „Następnej lekcji”); efekt Reacta zwracający Promise z `scrollIntoView` wyłączał aplikację; komunikat „offline” zasłaniał przycisk na 360 px; poziome przewijanie w laboratorium dźwięków; wyścig w onboardingu bez imienia (powrót do ekranu startowego).

## Integracje wymagające konfiguracji
- Dostawca TTS pt-PT dla `audio:build` (klucz w `.env`, sprawdzenie licencji, odsłuch każdego nagrania).
- (Etap 5) serwer pośredniczący AI.

## Kolejne zadania (po ocenie użytkownika)
1. Weryfikacja wymowy i treści tygodni 1–4 przez native speakera PT-PT (lista: `reports/content-report.md`, sekcja „Niezweryfikowane wymowy”).
2. Konfiguracja dostawcy TTS i wygenerowanie nagrań dla 461 elementów (+ odsłuch).
3. Test trenera AI z prawdziwym kluczem (koszt po stronie użytkownika).
4. Otwarcie stron źródeł i instytucji (wymaga dopuszczenia ich hostów w ustawieniach sieci środowiska) — teraz zweryfikowane tylko wyszukiwarką.
6. Etap 8: sprawdziany miesięczne, mapa kompetencji, analiza trudności; etap 9: tygodnie 5–26.
5. Testy na fizycznym Androidzie i iPhonie (instalacja PWA, mikrofon, TTS, Tryb Auto przy zablokowanym ekranie).
