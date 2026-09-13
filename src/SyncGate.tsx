import { useAuth } from '@clerk/clerk-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { initSync, runInitialSync } from './db/sync';

// Runs once per sign-in: wires local writes to a debounced push, and does
// the import-on-first-login pull/push against /api/state. Fires in the
// background — the app already renders from local Dexie data immediately.
export default function SyncGate({ children }: { children: ReactNode }) {
  const { userId, getToken } = useAuth();
  const syncedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || syncedForUser.current === userId) return;
    syncedForUser.current = userId;
    initSync(getToken);
    runInitialSync(getToken).catch((err) => console.error('initial sync failed', err));
  }, [userId, getToken]);

  return <>{children}</>;
}
