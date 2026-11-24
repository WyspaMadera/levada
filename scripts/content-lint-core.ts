/** Rdzeń lintera treści (bez I/O) — testowalny w Vitest. */
import { buildIndex, type ContentIndex, type RawContent } from '../src/content/index';
import { checkPronunciation, type PhonIssue } from '../src/content/phonetics';
import { findBrazilianSuspects } from '../src/content/brazil';
import { normalizeAnswer } from '../src/lib/answers';
import { readingCoverage, wordsOf } from '../src/content/coverage';
import type { LearningItem } from '../src/content/schema';

export type Finding = {
  severity: 'critical' | 'warning' | 'info';
  category: 'schema' | 'reference' | 'pronunciation' | 'brazil' | 'audio' | 'structure' | 'progression' | 'status';
  where: string;
  message: string;
};

export type LintResult = {
  findings: Finding[];
  index: ContentIndex;
  /** itemId → czy przeszedł wszystkie automatyczne kontrole (wymowa + BR). */
  autoPass: Map<string, boolean>;
  stats: { items: number; lessons: number; byStatus: Record<string, number>; needsReview: number };
};

const WORD_RE = /[\p{L}]+/gu;

/** Czy forma jest „znana”: identyczna, albo liczba mnoga (-s/-es) znanego słowa. Uproszczona lematyzacja. */
function isKnownForm(known: Set<string>, w: string): boolean {
  if (known.has(w)) return true;
  if (w.endsWith('es') && known.has(w.slice(0, -2))) return true;
  if (w.endsWith('s') && known.has(w.slice(0, -1))) return true;
  return false;
}

function ptTexts(item: LearningItem): string[] {
  return [item.pt, item.ptFem].filter((s): s is string => Boolean(s));
}

export function lintContent(raw: RawContent, opts: { fileExists?: (publicPath: string) => boolean } = {}): LintResult {
  const { index, problems } = buildIndex(raw);
  const findings: Finding[] = problems.map((p) => ({ severity: 'critical', category: 'schema', where: p.file, message: p.message }));
  const autoPass = new Map<string, boolean>();
  const add = (f: Finding) => findings.push(f);
  const itemRef = (where: string, id: string | undefined) => {
    if (id && !index.items.has(id)) add({ severity: 'critical', category: 'reference', where, message: `Brak elementu: ${id}` });
  };

  // ---- Elementy: wymowa, BR, audio, status
  for (const item of index.items.values()) {
    const where = `item:${item.id}`;
    const allowed = new Set(item.lintAllow ?? []);
    const pIssues: PhonIssue[] = [
      ...checkPronunciation(item.pt, item.pronunciation.plSlow, { natural: item.pronunciation.plNatural }),
      ...(item.ptFem && item.pronunciationFem
        ? checkPronunciation(item.ptFem, item.pronunciationFem.plSlow, { natural: item.pronunciationFem.plNatural }).map((i) => ({
            ...i,
            message: `[forma żeńska] ${i.message}`,
          }))
        : []),
    ].filter((i) => !allowed.has(i.code));
    for (const i of pIssues) {
      add({ severity: i.level === 'error' ? 'critical' : 'warning', category: 'pronunciation', where, message: i.message });
    }
    const br = ptTexts(item)
      .flatMap((t) => findBrazilianSuspects(t))
      .filter((b) => !allowed.has(b.pattern));
    for (const b of br) {
      add({
        severity: b.severity === 'suspect' ? 'warning' : 'info',
        category: 'brazil',
        where,
        message: `„${b.match}” (${b.pattern}): ${b.suggestionPl}`,
      });
    }
    autoPass.set(item.id, pIssues.length === 0 && br.filter((b) => b.severity === 'suspect').length === 0);
    if (item.reviewStatus === 'automatedChecked' && !autoPass.get(item.id)) {
      add({ severity: 'warning', category: 'status', where, message: 'Status automatedChecked, ale automatyczne kontrole zgłaszają problemy.' });
    }
    if (item.reviewStatus !== 'humanVerified' && !item.pronunciation.needsReview) {
      add({ severity: 'warning', category: 'status', where, message: 'needsReview=false bez weryfikacji przez człowieka.' });
    }
    if (item.standardEquivalentId) itemRef(where, item.standardEquivalentId);
    for (const f of [item.audio?.normal, item.audio?.slow]) {
      if (f && opts.fileExists && !opts.fileExists(f)) add({ severity: 'critical', category: 'audio', where, message: `Brak pliku audio: ${f}` });
    }
  }

  // ---- Audio manifest
  for (const [itemId, f] of Object.entries(index.audio.files)) {
    if (!index.items.has(itemId)) add({ severity: 'warning', category: 'audio', where: `audio:${itemId}`, message: 'Nagranie dla nieistniejącego elementu.' });
    for (const p of [f.normal, f.slow]) {
      if (p && opts.fileExists && !opts.fileExists(p)) add({ severity: 'critical', category: 'audio', where: `audio:${itemId}`, message: `Plik nie istnieje: ${p}` });
    }
  }

  // ---- Dialogi
  for (const d of index.dialogues.values()) d.lines.forEach((l, i) => itemRef(`dialogue:${d.id}#${i + 1}`, l.itemId));

  // ---- Ćwiczenia
  for (const ex of index.exercises.values()) {
    const where = `exercise:${ex.id}`;
    switch (ex.type) {
      case 'listenChoose':
      case 'readChoose':
      case 'recallChoose':
        itemRef(where, ex.targetItemId);
        ex.optionItemIds.forEach((o) => itemRef(where, o));
        if (!ex.optionItemIds.includes(ex.targetItemId))
          add({ severity: 'critical', category: 'structure', where, message: 'Opcje nie zawierają poprawnej odpowiedzi.' });
        break;
      case 'recallSay':
      case 'typeAnswer':
        itemRef(where, ex.targetItemId);
        break;
      case 'buildSentence':
      case 'transform': {
        itemRef(where, ex.targetItemId);
        if (ex.type === 'transform') itemRef(where, ex.baseItemId);
        const target = index.items.get(ex.targetItemId);
        if (target) {
          const built = normalizeAnswer(ex.tiles.join(' '));
          const accepted = [target.pt, ...(ex.acceptedAnswers ?? [])].map(normalizeAnswer);
          if (!accepted.includes(built))
            add({ severity: 'critical', category: 'structure', where, message: `Kafelki „${ex.tiles.join(' ')}” ≠ „${target.pt}”.` });
        }
        break;
      }
      case 'fillGap':
        if (!ex.options.includes(ex.answer)) add({ severity: 'critical', category: 'structure', where, message: 'Odpowiedź spoza opcji.' });
        itemRef(where, ex.fullItemId);
        if (ex.fullItemId) {
          const full = index.items.get(ex.fullItemId);
          if (full && normalizeAnswer(ex.sentencePt.replace('___', ex.answer)) !== normalizeAnswer(full.pt))
            add({ severity: 'warning', category: 'structure', where, message: `Zdanie z luką po uzupełnieniu ≠ „${full.pt}”.` });
        }
        for (const t of findBrazilianSuspects(ex.sentencePt.replace('___', ex.answer)))
          if (t.severity === 'suspect') add({ severity: 'warning', category: 'brazil', where, message: `„${t.match}”: ${t.suggestionPl}` });
        break;
      case 'minimalPair':
        ex.itemIds.forEach((i) => itemRef(where, i));
        break;
    }
  }

  // ---- Mówienie
  for (const s of index.speaking.values()) {
    s.modelItemIds.forEach((m) => itemRef(`speaking:${s.id}`, m));
    if (s.personal) itemRef(`speaking:${s.id}`, s.personal.templateItemId);
  }

  // ---- Scenariusze rozmów i pytania otwarte
  const seen = new Set<string>();
  for (const sc of index.scenarios) {
    const where = `scenario:${sc.id}`;
    if (seen.has(sc.id)) add({ severity: 'critical', category: 'schema', where, message: 'Zduplikowane ID scenariusza.' });
    seen.add(sc.id);
    if (!index.lessonById.has(sc.unlockAfterLessonId)) add({ severity: 'critical', category: 'reference', where, message: `Brak lekcji ${sc.unlockAfterLessonId}` });
    sc.turns.forEach((t) => {
      itemRef(where, t.promptItemId);
      t.answerItemIds.forEach((a) => itemRef(where, a));
      if (t.personal) itemRef(where, t.personal.templateItemId);
    });
  }
  for (const q of index.questions) {
    const where = `question:${q.id}`;
    if (seen.has(q.id)) add({ severity: 'critical', category: 'schema', where, message: 'Zduplikowane ID pytania.' });
    seen.add(q.id);
    if (!index.lessonById.has(q.unlockAfterLessonId)) add({ severity: 'critical', category: 'reference', where, message: `Brak lekcji ${q.unlockAfterLessonId}` });
    [q.questionItemId, ...q.exampleAnswerItemIds, ...q.usefulItemIds].forEach((i) => itemRef(where, i));
    if (q.personal) itemRef(where, q.personal.templateItemId);
  }

  // ---- Czytanki
  for (const r of index.readings) {
    const where = `reading:${r.id}`;
    if (seen.has(r.id)) add({ severity: 'critical', category: 'schema', where, message: 'Zduplikowane ID czytanki.' });
    seen.add(r.id);
    if (!index.lessonById.has(r.unlockAfterLessonId)) add({ severity: 'critical', category: 'reference', where, message: `Brak lekcji ${r.unlockAfterLessonId}` });
    r.sentenceItemIds.forEach((i) => itemRef(where, i));
    r.glossary.forEach((g) => g.itemId && itemRef(where, g.itemId));
    r.questions.forEach((q, i) => {
      if (q.answerIndex >= q.options.length) add({ severity: 'critical', category: 'structure', where, message: `Pytanie ${i + 1}: odpowiedź spoza opcji.` });
    });
    // każde słowo tekstu musi dać się dotknąć: znane z lekcji albo w słowniczku
    const glossed = new Set(r.glossary.map((g) => g.form.toLowerCase()));
    const cov = readingCoverage(index, r);
    const missing = cov.unknown.filter((w) => !glossed.has(w));
    if (missing.length) add({ severity: 'warning', category: 'progression', where, message: `Słowa bez znaczenia w słowniczku i spoza lekcji: ${missing.join(', ')}` });
    if (cov.ratio < 0.85)
      add({ severity: 'warning', category: 'progression', where, message: `Znane słowa: ${Math.round(cov.ratio * 100)}% (cel ~95%). Nieznane: ${cov.unknown.join(', ')}` });
    else add({ severity: 'info', category: 'progression', where, message: `Znane słowa (szacunek): ${Math.round(cov.ratio * 100)}% (${cov.known}/${cov.total}).` });
    for (const w of r.glossary) if (!r.sentenceItemIds.some((id) => wordsOf(index.items.get(id)?.pt ?? '').includes(w.form.toLowerCase())))
      add({ severity: 'warning', category: 'structure', where, message: `Słowniczek: „${w.form}” nie występuje w tekście.` });
  }

  // ---- Ściągawki, biblioteka, życiorys, misje
  for (const c of index.cheatsheets) {
    const where = `cheatsheet:${c.id}`;
    if (seen.has(c.id)) add({ severity: 'critical', category: 'schema', where, message: 'Zduplikowane ID ściągawki.' });
    seen.add(c.id);
    c.phrases.forEach((p) => itemRef(where, p.itemId));
  }
  for (const l of index.library) {
    const where = `library:${l.id}`;
    if (seen.has(l.id)) add({ severity: 'critical', category: 'schema', where, message: 'Zduplikowane ID źródła.' });
    seen.add(l.id);
    if (l.cost === 'unknown' || l.transcript === 'unknown') add({ severity: 'info', category: 'structure', where, message: 'Część informacji o źródle nieustalona (koszt/transkrypcja).' });
  }
  for (const b of index.biography) {
    const where = `biography:${b.id}`;
    if (!index.lessonById.has(b.unlockAfterLessonId)) add({ severity: 'critical', category: 'reference', where, message: `Brak lekcji ${b.unlockAfterLessonId}` });
    b.templates.forEach((t) => {
      itemRef(where, t.itemId);
      if (t.personal) itemRef(where, t.personal.templateItemId);
    });
  }
  for (const m of index.missions) {
    const where = `mission:${m.id}`;
    if (!index.lessonById.has(m.unlockAfterLessonId)) add({ severity: 'critical', category: 'reference', where, message: `Brak lekcji ${m.unlockAfterLessonId}` });
    m.phraseItemIds.forEach((i) => itemRef(where, i));
  }

  // ---- Mapa kompetencji
  const allTags = new Set([...index.items.values()].flatMap((i) => i.tags));
  for (const c of index.competences) {
    const where = `competence:${c.id}`;
    c.lessonIds.forEach((l) => {
      if (!index.lessonById.has(l)) add({ severity: 'critical', category: 'reference', where, message: `Brak lekcji ${l}` });
    });
    c.tags.forEach((t) => {
      if (!allTags.has(t)) add({ severity: 'warning', category: 'reference', where, message: `Żaden element nie ma tagu „${t}”.` });
    });
  }

  // ---- Testy
  for (const t of index.tests.values()) {
    const where = `test:${t.id}`;
    (t.scenarioIds ?? []).forEach((s) => {
      if (!index.scenarios.some((x) => x.id === s)) add({ severity: 'critical', category: 'reference', where, message: `Brak scenariusza ${s}` });
    });
    t.sections.forEach((sec) =>
      sec.exerciseIds.forEach((e) => {
        if (!index.exercises.has(e)) add({ severity: 'critical', category: 'reference', where, message: `Brak ćwiczenia: ${e}` });
      }),
    );
    t.speakingTaskIds.forEach((s) => {
      if (!index.speaking.has(s)) add({ severity: 'critical', category: 'reference', where, message: `Brak zadania mówienia: ${s}` });
    });
    t.remedialLessonIds.forEach((l) => {
      if (!index.lessonById.has(l)) add({ severity: 'critical', category: 'reference', where, message: `Brak lekcji: ${l}` });
    });
  }

  // ---- Dźwięki i mapa
  for (const s of index.sounds) {
    s.exampleItemIds.forEach((i) => itemRef(`sound:${s.id}`, i));
    s.minimalPairs.flat().forEach((i) => itemRef(`sound:${s.id}`, i));
  }
  const stopIds = new Set(index.stops.map((s) => s.id));
  for (const s of index.stops) if (s.factPtItemId) itemRef(`stop:${s.id}`, s.factPtItemId);
  for (const w of index.weeks)
    if (!stopIds.has(w.mapStopId)) add({ severity: 'critical', category: 'reference', where: `week:${w.week}`, message: `Brak przystanku ${w.mapStopId}` });

  // ---- Lekcje: referencje, struktura, progresja słownictwa
  const known = new Set<string>();
  const addKnown = (id: string) => {
    const it = index.items.get(id);
    if (!it) return;
    for (const t of ptTexts(it)) for (const m of t.toLowerCase().matchAll(WORD_RE)) known.add(m[0]);
  };
  for (const lesson of index.lessons) {
    const where = `lesson:${lesson.id}`;
    [...lesson.newItemIds, ...lesson.warmup.itemIds, ...(lesson.grammar?.exampleIds ?? []), ...(lesson.grammar?.tableItemIds ?? [])].forEach((i) =>
      itemRef(where, i),
    );
    if (!index.soundById.has(lesson.warmup.soundId)) add({ severity: 'critical', category: 'reference', where, message: `Brak dźwięku ${lesson.warmup.soundId}` });
    lesson.dialogueIds.forEach((d) => {
      if (!index.dialogues.has(d)) add({ severity: 'critical', category: 'reference', where, message: `Brak dialogu ${d}` });
    });
    lesson.exerciseIds.forEach((e) => {
      if (!index.exercises.has(e)) add({ severity: 'critical', category: 'reference', where, message: `Brak ćwiczenia ${e}` });
    });
    lesson.speakingTaskIds.forEach((s) => {
      if (!index.speaking.has(s)) add({ severity: 'critical', category: 'reference', where, message: `Brak zadania mówienia ${s}` });
    });
    lesson.prerequisites.forEach((p) => {
      if (!index.lessonById.has(p)) add({ severity: 'critical', category: 'reference', where, message: `Brak lekcji wymaganej ${p}` });
    });
    if (lesson.testId && !index.tests.has(lesson.testId)) add({ severity: 'critical', category: 'reference', where, message: `Brak testu ${lesson.testId}` });
    if (!stopIds.has(lesson.mapStopId)) add({ severity: 'critical', category: 'reference', where, message: `Brak przystanku ${lesson.mapStopId}` });
    if (lesson.newItemIds.length === 0 && !lesson.testId && lesson.dialogueIds.length === 0)
      add({ severity: 'critical', category: 'structure', where, message: 'Pusta lekcja (brak nowych elementów, dialogu i testu).' });
    if (lesson.week <= 4 && lesson.newItemIds.length > 12)
      add({ severity: 'warning', category: 'progression', where, message: `${lesson.newItemIds.length} nowych elementów — za dużo dla A0 (zalecane 5–8; zamknięte zbiory jak liczby mogą mieć więcej).` });
    const types = lesson.exerciseIds.map((e) => index.exercises.get(e)?.type);
    if (!types.includes('recallSay')) add({ severity: 'warning', category: 'structure', where, message: 'Brak ćwiczenia mówienia (recallSay).' });
    if (!types.some((t) => t === 'buildSentence' || t === 'transform' || t === 'fillGap'))
      add({ severity: 'warning', category: 'structure', where, message: 'Brak ćwiczenia budowania zdań.' });
    if (lesson.speakingTaskIds.length < 3 && !lesson.testId)
      add({ severity: 'warning', category: 'structure', where, message: 'Mniej niż 3 zadania „Mówię samodzielnie”.' });
    for (const id of [...lesson.newItemIds, ...lesson.warmup.itemIds]) {
      const lvl = index.items.get(id)?.level;
      if (lesson.week <= 4 && lvl && lvl !== 'A0' && lvl !== 'A1')
        add({ severity: 'warning', category: 'progression', where, message: `Element ${id} ma poziom ${lvl} w miesiącu 1.` });
    }

    // progresja: nowe słowa tej lekcji są „znane”; przykłady i dialogi nie powinny wprowadzać nowych słów
    lesson.newItemIds.forEach(addKnown);
    lesson.warmup.itemIds.forEach(addKnown);
    const checkKnown = (id: string, ctx: string) => {
      const it = index.items.get(id);
      if (!it) return;
      const unknown = new Set<string>();
      for (const t of ptTexts(it)) for (const m of t.toLowerCase().matchAll(WORD_RE)) if (!isKnownForm(known, m[0])) unknown.add(m[0]);
      if (unknown.size)
        add({
          severity: 'info',
          category: 'progression',
          where,
          message: `${ctx} „${it.pt}”: słowa spoza wprowadzonego materiału: ${[...unknown].join(', ')} (sprawdź, czy są wyjaśnione).`,
        });
    };
    (lesson.grammar?.exampleIds ?? []).forEach((i) => checkKnown(i, 'Przykład'));
    lesson.dialogueIds.forEach((d) => index.dialogues.get(d)?.lines.forEach((l) => checkKnown(l.itemId, 'Dialog')));
    (lesson.grammar?.exampleIds ?? []).forEach(addKnown);
    lesson.dialogueIds.forEach((d) => index.dialogues.get(d)?.lines.forEach((l) => addKnown(l.itemId)));
  }

  // ---- Polskie teksty: słowa zakończone na „ż”, które zwykle są przekręconym „sz” (np. „maż” zamiast „masz”)
  const PL_OK_Z = new Set(['też', 'już', 'aż', 'jeż', 'nóż', 'mąż', 'podróż', 'straż', 'niż', 'wzdłuż', 'również', 'pokaż', 'ułóż', 'wskaż', 'połóż', 'każ', 'odłóż', 'dołóż', 'zważ', 'uważ', 'ż', 'grabież', 'młodzież', 'odzież', 'krawędź']);
  const scanPl = (where: string, text: string | undefined) => {
    if (!text) return;
    for (const m of text.matchAll(/(\p{L}+ż)(?=[\s,.!?;:)]|$)/gu)) {
      const w = m[1]!;
      // fragment w cudzysłowie „…” to zwykle zapis wymowy lub cytat PT — pomijamy
      const before = text.slice(0, m.index);
      if ((before.match(/„/g)?.length ?? 0) > (before.match(/”/g)?.length ?? 0)) continue;
      if (!PL_OK_Z.has(w.toLowerCase()) && !/^[A-ZĂÃẼĨÕŨÊÔŃŻ-]+$/u.test(w))
        add({ severity: 'warning', category: 'structure', where, message: `Podejrzane polskie słowo „${w}” (może „…sz”?).` });
    }
  };
  for (const it of index.items.values()) {
    scanPl(`item:${it.id}`, it.pl);
    scanPl(`item:${it.id}`, it.plFem);
    scanPl(`item:${it.id}`, it.usagePl);
  }
  for (const ex of index.exercises.values()) {
    scanPl(`exercise:${ex.id}`, ex.promptPl);
    scanPl(`exercise:${ex.id}`, ex.explanationPl);
  }
  for (const sp of index.speaking.values()) {
    scanPl(`speaking:${sp.id}`, sp.promptPl);
    scanPl(`speaking:${sp.id}`, sp.hintPl);
  }
  for (const l of index.lessons) {
    scanPl(`lesson:${l.id}`, l.titlePl);
    scanPl(`lesson:${l.id}`, l.grammar?.explanationPl);
    l.goals.forEach((g) => scanPl(`lesson:${l.id}`, g));
    l.canDo.forEach((g) => scanPl(`lesson:${l.id}`, g));
  }

  const byStatus: Record<string, number> = {};
  let needsReview = 0;
  for (const it of index.items.values()) {
    byStatus[it.reviewStatus] = (byStatus[it.reviewStatus] ?? 0) + 1;
    if (it.pronunciation.needsReview) needsReview++;
  }
  return { findings, index, autoPass, stats: { items: index.items.size, lessons: index.lessons.length, byStatus, needsReview } };
}
