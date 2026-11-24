# RAPORT.md — LEVADA po etapie 6

> Etapy 5 (rozmowy, opcjonalny trener AI) i 6 (Tryb Auto) dodane po etapie 4 — szczegóły w IMPLEMENTATION_STATUS.md.

## Co działa
Działająca aplikacja PWA (nie makieta): onboarding → plan dnia → lekcja (8 kroków) → wymowa i odsłuch → ćwiczenia → mówienie → podsumowanie → powtórki FSRS → zeszyt błędów → sprawdziany → postępy → mapa Madery → eksport/import. Pełna lista: [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

Kryteria gotowości pierwszej wersji (sekcja 26 specyfikacji):

| # | Kryterium | Stan |
|---|---|---|
| 1 | Uruchomienie bez konta | ✅ |
| 2 | Start od A0 | ✅ lekcja 1 zakłada zero wiedzy |
| 3 | Ukończenie prawdziwej lekcji | ✅ (test e2e) |
| 4 | Polska wymowa | ✅ każdy element ma `plSlow`; zdania tam, gdzie trzeba, także wersję naturalną |
| 5 | Odsłuch PT-PT | ⚠️ działa przez głos pt-PT urządzenia; **brak nagrań**; bez głosu — jasny komunikat |
| 6 | Ćwiczenia | ✅ 9 typów |
| 7 | Ustne przećwiczenie zdań | ✅ `recallSay`, „Mówię samodzielnie”, rozmowy, nagrywanie |
| 8 | Zapis postępów | ✅ IndexedDB |
| 9 | Powtórki | ✅ FSRS, 5 kompetencji |
| 10 | Mapa kursu | ✅ |
| 11 | Zmiana dostępnego czasu | ✅ na dziś i domyślnie |
| 12 | Telefon | ✅ testy na viewporcie 360 px (emulacja, nie fizyczne urządzenie) |
| 13 | Eksport/import | ✅ (test e2e + jednostkowy) |
| 14 | Bez AI | ✅ |
| 15 | Komunikat o niedostępnej funkcji | ✅ moduły z kolejnych etapów oznaczone, bez udawanych przycisków |

## Czego brakuje
- **Weryfikacja językowa przez człowieka** — 0 z 461 elementów zweryfikowanych. To najważniejszy brak.
- **Nagrania audio** — 0 plików (skrypt gotowy, brak skonfigurowanego dostawcy).
- Trener AI, ściągawki, czytanki, podcasty, pełny Tryb Auto, egzamin końcowy, tygodnie 5–26 (etapy 5–9).

## Wyniki testów
typecheck ✅ · ESLint ✅ · `lint:content` 0 krytycznych / 0 ostrzeżeń · Vitest 70/70 ✅ · build ✅ · Playwright 10/10 ✅ · offline ✅ (Chromium).

## Niezweryfikowane elementy językowe
Wszystkie 461 (lista z zapisem: `reports/content-report.md`, generowana przez `npm run lint:content`).
Najmniej pewne zapisy — do sprawdzenia w pierwszej kolejności — w tabeli wyjątków [PRONUNCIATION.md §12](PRONUNCIATION.md):
*obrigado* (pierwsze o), *tenho* (TĂ-ńu vs TÊ-ńu), *ei* w normie lizbońskiej (*Madeira, seis, -feira, meia*), *telemóvel*, *supermercado*,
*quarenta/cinquenta*, ściągnięcia *à/às/ao*, pary otwarte–zamknięte (*este/esta, novo/nova, ele/ela*), *querer/queria*,
oraz wszystkie wersje naturalne z łączeniem wyrazów (*de ajuda, de um, que horas, para onde, de onde*).
Ponadto do sprawdzenia przez native speakera: naturalność dialogów (szczególnie „Se faz favor” vs „Por favor”, odpowiedzi z powtórzeniem czasownika, rodzajnik przed imionami)
oraz ciekawostki o przystankach na mapie (opisane ostrożnie, „według tradycji”).

## Raport dostępności funkcji na urządzeniach mobilnych
**Przetestowano wyłącznie w Chromium (Playwright) z emulacją ekranu 360×740 i dotyku.** Nie testowano na fizycznym Androidzie ani iPhonie.

| Funkcja | Android Chrome (oczekiwane) | iOS Safari / PWA (oczekiwane) | Sprawdzone |
|---|---|---|---|
| Układ 360 px, brak poziomego przewijania | ✅ | ✅ | ✅ Chromium |
| Instalacja PWA | menu „Zainstaluj” | „Do ekranu początkowego” | manifest/SW zbudowane; instalacja nie testowana |
| Offline | ✅ | ✅ (z ograniczeniami pamięci Safari) | ✅ Chromium |
| Głos pt-PT (TTS) | po instalacji danych głosowych Google | po pobraniu głosu (np. Joana) | logika wyboru — testy jednostkowe; brak głosów w środowisku testowym |
| Nagrywanie (MediaRecorder) | ✅ webm/opus | ✅ od iOS 14.3 (mp4) | kod obsługuje oba formaty; nie testowano z mikrofonem |
| Rozpoznawanie mowy | nieużywane do oceny | — | — |
| Tryb Auto przy zablokowanym ekranie | zwykle się zatrzymuje (TTS) | zatrzymuje się | **nie gwarantujemy**; pełne wsparcie wymaga plików audio, a docelowo być może aplikacji natywnej. Logika odtwarzacza przetestowana z podstawionym TTS w Chromium |
| Media Session (przyciski na ekranie blokady) | częściowo | częściowo | kod gotowy, nie testowany na urządzeniu |

## Integracje wymagające konfiguracji
1. **TTS do nagrań:** `.env` z `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` lub `GOOGLE_TTS_API_KEY`, potem `npm run audio:build -- --slow`.
   Przed publikacją: sprawdzić licencję dostawcy, wpisać ją do `content/audio/manifest.json`, odsłuchać pliki i ustawić `checked: true`.
2. **Trener AI:** `ANTHROPIC_API_KEY=… npm run ai:proxy` na własnym serwerze (HTTPS, `ALLOWED_ORIGINS`, zalecany `LEVADA_PROXY_TOKEN`), potem adres w Ustawieniach. Przetestowany tylko w trybie testowym.

## Instrukcja publikacji
```bash
npm run check
```
```bash
npm run test:e2e
```
Następnie wgraj zawartość katalogu `dist/` na hosting statyczny z HTTPS (np. GitHub Pages, Netlify, Cloudflare Pages). Aplikacja używa ścieżek względnych i routingu `#`, więc działa również w podkatalogu i nie wymaga reguł przekierowań.
