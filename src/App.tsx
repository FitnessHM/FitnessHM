import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db/schema';
import { seedExampleBlockIfEmpty } from './db/seed';
import { getMostRecentBlock, getNextUnloggedSession } from './db/repository';
import OnboardingWizard from './features/onboarding/OnboardingWizard';
import BlockDashboard from './features/dashboard/BlockDashboard';
import SessionLogger from './features/logger/SessionLogger';

type View = { name: 'loading' } | { name: 'onboarding' } | { name: 'dashboard' } | { name: 'logger' };

export default function App() {
  const [view, setView] = useState<View>({ name: 'loading' });
  const [blockId, setBlockId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await seedExampleBlockIfEmpty();
      const block = await getMostRecentBlock();
      if (block) {
        setBlockId(block.id);
        setView({ name: 'dashboard' });
      } else {
        setView({ name: 'onboarding' });
      }
    })();
  }, []);

  const nextSession = useLiveQuery(
    () => (blockId ? getNextUnloggedSession(blockId) : undefined),
    [blockId]
  );

  if (view.name === 'loading') {
    return <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">Loading...</main>;
  }

  if (view.name === 'onboarding') {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <OnboardingWizard
          onComplete={(id) => {
            setBlockId(id);
            setView({ name: 'dashboard' });
          }}
        />
      </main>
    );
  }

  if (view.name === 'logger' && blockId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <SessionLogger
          blockId={blockId}
          session={nextSession ?? null}
          onSaved={() => setView({ name: 'dashboard' })}
        />
      </main>
    );
  }

  if (blockId) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <BlockDashboard blockId={blockId} onStartNewBlock={() => setView({ name: 'onboarding' })} />
        <div className="max-w-2xl mx-auto px-6 pb-6">
          <button
            type="button"
            onClick={() => setView({ name: 'logger' })}
            className="w-full py-3 bg-blue-600 rounded font-semibold"
          >
            Log a session
          </button>
        </div>
      </main>
    );
  }

  return null;
}
