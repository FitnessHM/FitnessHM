import { lazy, Suspense, useEffect, useState } from 'react';
import { getActiveBlock } from './db/repository';
import type { PrescribedSession } from './db/schema';
import AppShell, { type Tab } from './components/AppShell';
import HomeScreen from './features/home/HomeScreen';

// Home is the landing view for almost every session, so it loads eagerly.
// Everything else is a separate chunk, fetched only when actually
// navigated to -- onboarding (a one-time flow most sessions never hit
// again), the logger/settings/plan screens (a tap away, not the first
// paint).
const OnboardingWizard = lazy(() => import('./features/onboarding/OnboardingWizard'));
const PlanScreen = lazy(() => import('./features/plan/PlanScreen'));
const SessionLogger = lazy(() => import('./features/logger/SessionLogger'));
const SettingsScreen = lazy(() => import('./features/settings/SettingsScreen'));

type View =
  | { name: 'loading' }
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'plan' }
  | { name: 'logger'; session: PrescribedSession | null }
  | { name: 'settings' };

type StravaNotice = 'connected' | 'denied' | 'error' | null;

function readStravaNotice(): StravaNotice {
  const value = new URLSearchParams(window.location.search).get('strava');
  if (value === 'connected' || value === 'denied' || value === 'error') return value;
  return null;
}

// Which bottom-tab/sidebar item a given view should show as active, for
// views reachable both from the nav and from elsewhere (e.g. tapping a
// specific session's Log button isn't "navigating to Log", but the shell
// still needs some tab highlighted).
function activeTabFor(view: View): Tab {
  if (view.name === 'plan') return 'plan';
  if (view.name === 'logger') return 'log';
  if (view.name === 'settings') return 'settings';
  return 'today';
}

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [blockId, setBlockId] = useState<string | null>(null);
  const [stravaNotice] = useState<StravaNotice>(readStravaNotice);

  useEffect(() => {
    (async () => {
      const block = await getActiveBlock();
      if (block) setBlockId(block.id);

      if (stravaNotice) {
        // Strip the query param so a refresh doesn't re-show the notice.
        window.history.replaceState(null, '', window.location.pathname);
        setView({ name: 'settings' });
        return;
      }

      setView(block ? { name: 'home' } : { name: 'onboarding' });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const navigate = (tab: Tab) => {
    if (tab === 'today') setView(blockId ? { name: 'home' } : { name: 'onboarding' });
    else if (tab === 'plan' && blockId) setView({ name: 'plan' });
    else if (tab === 'log' && blockId) setView({ name: 'logger', session: null });
    else if (tab === 'settings') setView({ name: 'settings' });
  };

  if (view.name === 'loading') {
    return <main className="min-h-screen bg-bg" />;
  }

  // Onboarding is a focused, full-screen flow -- no nav chrome around it.
  if (view.name === 'onboarding') {
    return (
      <main className="min-h-screen bg-bg text-primary">
        <Suspense fallback={null}>
          <OnboardingWizard
            showWelcome={blockId === null}
            onComplete={(id) => {
              setBlockId(id);
              setView({ name: 'home' });
            }}
          />
        </Suspense>
      </main>
    );
  }

  return (
    <AppShell activeTab={activeTabFor(view)} onNavigate={navigate}>
      <Suspense fallback={null}>
        {view.name === 'plan' && blockId && <PlanScreen blockId={blockId} />}

        {view.name === 'logger' && blockId && (
          <SessionLogger blockId={blockId} session={view.session} onSaved={() => setView({ name: 'home' })} />
        )}

        {view.name === 'settings' && (
          <SettingsScreen
            stravaNotice={stravaNotice}
            onBack={() => setView(blockId ? { name: 'home' } : { name: 'onboarding' })}
            onStartedOver={() => {
              setBlockId(null);
              setView({ name: 'onboarding' });
            }}
          />
        )}
      </Suspense>

      {view.name === 'home' && blockId && (
        <HomeScreen
          blockId={blockId}
          onStartNewBlock={() => setView({ name: 'onboarding' })}
          onLogSession={(session) => setView({ name: 'logger', session })}
          onOpenSettings={() => setView({ name: 'settings' })}
        />
      )}
    </AppShell>
  );
}
