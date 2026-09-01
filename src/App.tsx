import { useEffect, useState } from 'react';
import { getActiveBlock } from './db/repository';
import type { PrescribedSession } from './db/schema';
import OnboardingWizard from './features/onboarding/OnboardingWizard';
import HomeScreen from './features/home/HomeScreen';
import SessionLogger from './features/logger/SessionLogger';

type View =
  | { name: 'loading' }
  | { name: 'onboarding' }
  | { name: 'home' }
  | { name: 'logger'; session: PrescribedSession | null };

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [blockId, setBlockId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const block = await getActiveBlock();
      if (block) {
        setBlockId(block.id);
        setView({ name: 'home' });
      } else {
        setView({ name: 'onboarding' });
      }
    })();
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

  if (blockId) {
    return (
      <main className="min-h-screen bg-bg text-primary">
        <HomeScreen
          blockId={blockId}
          onStartNewBlock={() => setView({ name: 'onboarding' })}
          onLogSession={(session) => setView({ name: 'logger', session })}
        />
      </main>
    );
  }

  return null;
}
