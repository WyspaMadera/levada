import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation, useParams } from 'react-router';
import type { ComponentType } from 'react';
import { Headphones, Map, Menu, MessagesSquare, Sun } from 'lucide-react';
import { AppProvider, useApp } from './state/AppContext';
import { contentProblems } from './content/content';
import { cx, Notice } from './components/ui';
import { UpdatePrompt } from './components/UpdatePrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import Today from './screens/Today';
import Onboarding from './screens/Onboarding';

const Trail = lazy(() => import('./screens/Trail'));
const LessonPlayer = lazy(() => import('./screens/LessonPlayer'));
const Review = lazy(() => import('./screens/Review'));
const Sounds = lazy(() => import('./screens/Sounds'));
const SoundDetail = lazy(() => import('./screens/SoundDetail'));
const Conversations = lazy(() => import('./screens/Conversations'));
const ScenarioTrainer = lazy(() => import('./screens/ScenarioTrainer'));
const QuestionsSession = lazy(() => import('./screens/QuestionsSession'));
const DialogueTrainer = lazy(() => import('./screens/DialogueTrainer'));
const AiTutor = lazy(() => import('./screens/AiTutor'));
const Listen = lazy(() => import('./screens/Listen'));
const More = lazy(() => import('./screens/More'));
const Settings = lazy(() => import('./screens/Settings'));
const Progress = lazy(() => import('./screens/Progress'));
const Mistakes = lazy(() => import('./screens/Mistakes'));
const TestPlayer = lazy(() => import('./screens/TestPlayer'));
const Tests = lazy(() => import('./screens/Tests'));
const Profile = lazy(() => import('./screens/Profile'));
const Recordings = lazy(() => import('./screens/Recordings'));
const ReadingsList = lazy(() => import('./screens/Readings').then((m) => ({ default: m.ReadingsList })));
const ReadingView = lazy(() => import('./screens/Readings'));
const CheatsheetsList = lazy(() => import('./screens/Cheatsheets').then((m) => ({ default: m.CheatsheetsList })));
const CheatsheetView = lazy(() => import('./screens/Cheatsheets'));
const Library = lazy(() => import('./screens/Library'));
const Biography = lazy(() => import('./screens/Biography'));
const MyPhrases = lazy(() => import('./screens/MyPhrases'));
const Courage = lazy(() => import('./screens/Courage'));
const Missions = lazy(() => import('./screens/Missions'));
const Competences = lazy(() => import('./screens/Competences'));

const TABS = [
  { to: '/', label: 'Dzisiaj', icon: Sun, end: true },
  { to: '/szlak', label: 'Szlak', icon: Map },
  { to: '/rozmowy', label: 'Rozmowy', icon: MessagesSquare },
  { to: '/sluchanie', label: 'Słuchanie', icon: Headphones },
  { to: '/wiecej', label: 'Więcej', icon: Menu },
];

function TabLayout() {
  const loc = useLocation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <main className="flex-1 px-4 pb-28 pt-[max(1rem,env(safe-area-inset-top))]">
        {contentProblems.length > 0 && (
          <Notice tone="warn" title="Problem z treścią kursu" className="mb-4">
            Niektóre pliki treści są niepoprawne ({contentProblems.length}). Uruchom <code>npm run lint:content</code>.
          </Notice>
        )}
        <ErrorBoundary resetKey={loc.pathname}>
          <Suspense fallback={<Loading />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <nav
        aria-label="Główna nawigacja"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--surface)]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cx(
                    'focus-ring flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                    isActive ? 'text-atlantic-700 dark:text-atlantic-100' : 'text-[var(--muted)]',
                  )
                }
              >
                <Icon className="size-6" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function FocusLayout() {
  const loc = useLocation();
  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <ErrorBoundary resetKey={loc.pathname}>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

/** Nowy :id = nowy egzemplarz ekranu (bez przenoszenia stanu z poprzedniej lekcji/scenariusza). */
function Keyed({ C }: { C: ComponentType }) {
  const { id } = useParams();
  return <C key={id} />;
}

function Loading() {
  return <p className="py-10 text-center text-[var(--muted)]">Ładowanie…</p>;
}

function Gate() {
  const { ready, settings } = useApp();
  const loc = useLocation();
  if (!ready) return <Loading />;
  if (!settings.onboardingDone && loc.pathname !== '/start') return <Navigate to="/start" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Routes>
          <Route element={<Gate />}>
            <Route path="/start" element={<Onboarding />} />
            <Route element={<TabLayout />}>
              <Route index element={<Today />} />
              <Route path="szlak" element={<Trail />} />
              <Route path="rozmowy" element={<Conversations />} />
              <Route path="rozmowy/ai" element={<AiTutor />} />
              <Route path="sluchanie" element={<Listen />} />
              <Route path="wiecej" element={<More />} />
              <Route path="dzwieki" element={<Sounds />} />
              <Route path="dzwieki/:id" element={<Keyed C={SoundDetail} />} />
              <Route path="ustawienia" element={<Settings />} />
              <Route path="postepy" element={<Progress />} />
              <Route path="bledy" element={<Mistakes />} />
              <Route path="sprawdziany" element={<Tests />} />
              <Route path="zyciorys" element={<Biography />} />
              <Route path="zyciorys/dane" element={<Profile />} />
              <Route path="czytanki" element={<ReadingsList />} />
              <Route path="czytanki/:id" element={<Keyed C={ReadingView} />} />
              <Route path="sciagawki" element={<CheatsheetsList />} />
              <Route path="sciagawki/:id" element={<Keyed C={CheatsheetView} />} />
              <Route path="sluchaj" element={<Library />} />
              <Route path="moje-zdania" element={<MyPhrases />} />
              <Route path="minuta-odwagi" element={<Courage />} />
              <Route path="misje" element={<Missions />} />
              <Route path="kompetencje" element={<Competences />} />
              <Route path="nagrania" element={<Recordings />} />
            </Route>
            <Route element={<FocusLayout />}>
              <Route path="lekcja/:id" element={<Keyed C={LessonPlayer} />} />
              <Route path="powtorki" element={<Review />} />
              <Route path="rozmowy/scenariusz/:id" element={<Keyed C={ScenarioTrainer} />} />
              <Route path="rozmowy/pytania" element={<QuestionsSession />} />
              <Route path="rozmowy/dialog/:id" element={<Keyed C={DialogueTrainer} />} />
              <Route path="sprawdzian/:id" element={<Keyed C={TestPlayer} />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <UpdatePrompt />
      </HashRouter>
    </AppProvider>
  );
}
