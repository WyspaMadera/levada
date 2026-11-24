# LEVADA — krok po kroku do portugalskiego

Aplikacja PWA do nauki **portugalskiego europejskiego (pt-PT)** od absolutnego zera, dla dorosłego Polaka mieszkającego na Maderze.
Interfejs i wyjaśnienia po polsku. Każde słowo i zdanie ma: zapis portugalski, tłumaczenie, **zapis wymowy dla Polaka („Fonetyka PL”)**
i odsłuch pt-PT (jeśli urządzenie ma głos pt-PT lub istnieje nagranie). Bez konta, bez serwera — dane zostają na urządzeniu.

> **Stan treści:** pierwszy miesiąc kursu (tygodnie 1–4) jest przygotowany starannie, ale **żaden zapis wymowy ani tekst nie został
> jeszcze zweryfikowany przez native speakera**. Wszystkie pozycje mają status `draft` i etykietę „wymowa niezweryfikowana”.
> Szczegóły: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [RAPORT.md](RAPORT.md).

## Uruchomienie

Wymagania: Node.js 22+, npm 10+.

```bash
npm install
```

```bash
npm run dev
```

Aplikacja: http://localhost:5173. Wersja produkcyjna:

```bash
npm run build
```

```bash
npm run preview
```

### Polecenia
| Polecenie | Co robi |
|---|---|
| `npm run dev` / `build` / `preview` | serwer deweloperski / build produkcyjny (z Service Workerem) / podgląd buildu |
| `npm run typecheck` | TypeScript (strict) |
| `npm run lint` | ESLint |
| `npm test` | Vitest (logika, IndexedDB, komponenty, walidacja treści) |
| `npm run test:e2e` | Playwright (ścieżki użytkownika na viewporcie 360 px) — wymaga `npm run build` |
| `npm run lint:content` | walidacja treści + raport `reports/content-report.md` |
| `npm run content:status` | jw. + automatyczna zmiana statusu `draft` ↔ `automatedChecked` (nigdy `humanVerified`) |
| `npm run audio:build` | generowanie nagrań pt-PT przez dostawcę TTS (wymaga konfiguracji, zob. niżej) |
| `npm run icons:build` | ikony PWA z `public/icons/icon.svg` |
| `npm run review:export` / `review:apply` | arkusz CSV do weryfikacji przez native speakera / wczytanie decyzji recenzenta |
| `npm run ai:proxy` / `ai:proxy:mock` | serwer pośredniczący trenera AI / tryb testowy bez API |
| `npm run check` | typecheck + lint + lint:content + testy + build |

## Instalacja jako aplikacja (PWA)
- **Android (Chrome):** menu ⋮ → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”.
- **iPhone (Safari):** przycisk Udostępnij → „Do ekranu początkowego”.
- **Komputer (Chrome/Edge):** ikona instalacji w pasku adresu.

Po pierwszym uruchomieniu aplikacja działa offline (lekcje, powtórki, postępy). Głosy TTS sieciowe wymagają internetu; głosy systemowe — nie.

## Publikacja
Build (`dist/`) to statyczne pliki z routingiem przez `#` (HashRouter) i względnymi ścieżkami (`base: './'`) —
można je wrzucić na dowolny hosting statyczny (GitHub Pages, Netlify, Cloudflare Pages, serwer www) również do podkatalogu. Wymagany HTTPS (Service Worker, mikrofon).

## Konfiguracja audio
1. **Głos urządzenia (domyślnie):** aplikacja szuka głosu `pt-PT`. **Nigdy nie wybiera po cichu `pt-BR`** — gdy brak pt-PT, pokazuje instrukcję
   (Ustawienia → Audio). Głos brazylijski można włączyć tylko świadomie (z ostrzeżeniem i znacznikiem „BR”).
   - Android: Ustawienia → Zamiana tekstu na mowę → silnik Google → dane głosowe → Portugalski (Portugalia).
   - iOS: Ustawienia → Dostępność → Treść mówiona → Głosy → Portugalski (Portugalia), np. Joana.
   - Windows: Ustawienia → Czas i język → Mowa → Dodaj głosy → Portugalski (Portugalia).
2. **Nagrania (zalecane docelowo):** `npm run audio:build` z kluczem dostawcy w pliku `.env` (poza repozytorium):
   `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (głos np. `pt-PT-RaquelNeural`) albo `GOOGLE_TTS_API_KEY` (np. `pt-PT-Wavenet-A`).
   Pliki trafiają do `public/audio/pt-PT/` i do `content/audio/manifest.json` z `checked: false` — trzeba je odsłuchać i sprawdzić licencję.
   **Obecnie nie ma żadnych nagrań** (nie skonfigurowano dostawcy).

## Weryfikacja przez native speakera
1. `npm run review:export` (opcjonalnie `-- --only w01,w02`) tworzy `reports/review-sheet.csv` — otwórz w Excelu lub Arkuszach Google.
2. Recenzent wpisuje w kolumnie „decyzja”: **OK** (zapis poprawny), **POPRAW** (i wypełnia poprawiony PT / PL / wymowę) albo **?** (wątpliwość, z uwagą).
3. `npm run review:apply -- --file reports/review-sheet.csv --reviewer "Imię Nazwisko"` — OK → status `humanVerified` z nazwiskiem i datą; POPRAW → poprawka + ponowna kontrola; uwagi → `reports/review-notes.md`.
4. `npm run lint:content`, a potem commit.

## Trener rozmów AI (opcjonalnie)
Aplikacja nigdy nie przechowuje klucza API. Trener łączy się z **Twoim serwerem pośredniczącym** (`server/ai-proxy.ts`):

```bash
ANTHROPIC_API_KEY=… ALLOWED_ORIGINS=https://twoja-domena LEVADA_PROXY_TOKEN=tajny-token npm run ai:proxy
```

Następnie w aplikacji: Ustawienia → „Trener AI” → adres serwera (+ token) → zgoda. Tryb testowy bez kosztów: `npm run ai:proxy:mock`.
Serwer: model Claude Opus 5.5, odpowiedzi w ustalonym formacie JSON, limit 30 zapytań / 10 min na IP, brak logowania treści rozmów.
Koszt wywołań ponosi właściciel klucza. Odpowiedzi AI są oznaczone jako niezweryfikowane.

## Struktura
```
content/   treści kursu (JSON) — poprawki bez zmiany kodu
src/       aplikacja (content/ schematy i kontrola, db/ IndexedDB, lib/ logika, components/, screens/)
scripts/   lint treści, generator audio, ikony
tests/e2e/ Playwright
```
Dokumenty: [PLAN.md](PLAN.md) · [CLAUDE.md](CLAUDE.md) · [CURRICULUM.md](CURRICULUM.md) · [PRONUNCIATION.md](PRONUNCIATION.md) ·
[CONTENT_GUIDELINES.md](CONTENT_GUIDELINES.md) · [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) · [RAPORT.md](RAPORT.md)

## Ograniczenia (uczciwie)
- Zapis „Fonetyka PL” to przybliżenie dydaktyczne; dźwięki ă, ê, ô, ɫ, nosówki i rr nie mają polskich odpowiedników. Nic nie jest zweryfikowane przez native speakera.
- Głos TTS bywa niedokładny (samogłoski otwarte/zamknięte, intonacja). Spowolniony TTS brzmi mniej naturalnie niż nagranie wolnej wymowy.
- Mówienie oceniasz sam(a); rozpoznawanie mowy nie jest używane do oceny akcentu.
- Tryb Auto przy zablokowanym ekranie może się zatrzymać (szczególnie iOS) — synteza mowy w tle nie jest niezawodna.
- Gotowe są tygodnie 1–4 z 26. Ściągawki, czytanki, pełny Tryb Auto — w kolejnych etapach (w aplikacji oznaczone jako „w przygotowaniu”).
- Trener AI przetestowano tylko z serwerem w trybie testowym — nie z prawdziwym API.
