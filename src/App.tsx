import { useEffect, useState } from 'react';
import { getActiveBlock } from './db/repository';
import type { PrescribedSession } from './db/schema';
import OnboardingWizard from './features/onboarding/OnboardingWizard';
import HomeScreen from './features/home/HomeScreen';
import SessionLogger from './features/logger/SessionLogger';
import SettingsScreen from './features/settings/SettingsScreen';

type View =
  | { name: 'loading' }
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'logger'; session: PrescribedSession | null }
  | { name: 'settings' };

type StravaNotice = 'connected' | 'denied' | 'error' | null;

function readStravaNotice(): StravaNotice {
  const value = new URLSearchParams(window.location.search).get('strava');
  if (value === 'connected' || value === 'denied' || value === 'error') return value;
  return null;
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

  if (view.name === 'loading') {
    return <main className="min-h-screen bg-bg" />;
  }

  if (view.name === 'onboarding') {
    return (
      <main className="min-h-screen bg-bg text-primary">
        <OnboardingWizard
          showWelcome={blockId === null}
          onComplete={(id) => {
            setBlockId(id);
            setView({ name: 'home' });
          }}
        />
      </main>
    );
  }

  if (view.name === 'logger' && blockId) {
    return (
      <main className="min-h-screen bg-bg text-primary">
        <SessionLogger blockId={blockId} session={view.session} onSaved={() => setView({ name: 'home' })} />
      </main>
    );
  }

  if (view.name === 'settings') {
    return (
      <main className="min-h-screen bg-bg text-primary">
        <SettingsScreen
          stravaNotice={stravaNotice}
          onBack={() => setView(blockId ? { name: 'home' } : { name: 'onboarding' })}
          onStartedOver={() => {
            setBlockId(null);
            setView({ name: 'onboarding' });
          }}
        />
      </main>
    );
  }

  if (blockId) {
    return (
      <main className="min-h-screen bg-bg text-primary">
        <HomeScreen
          blockId={blockId}
          onStartNewBlock={() => setView({ name: 'onboarding' })}
          onLogSession={(session) => setView({ name: 'logger', session })}
          onOpenSettings={() => setView({ name: 'settings' })}
        />
      </main>
    );
  }

  return null;
}
