import { db } from './schema';
import type { Athlete, TrainingBlock, TimedEffort, PrescribedSession, SessionLog } from './schema';

export interface StatePayload {
  updatedAt: string;
  athlete: Athlete | null;
  blocks: TrainingBlock[];
  efforts: TimedEffort[];
  sessions: PrescribedSession[];
  logs: SessionLog[];
}

type GetToken = () => Promise<string | null>;

const LAST_SYNCED_KEY = 'fitnesshm.lastSyncedAt';
const DEBOUNCE_MS = 2000;

async function authedFetch(path: string, getToken: GetToken, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in');
  return fetch(path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

async function exportLocalState(): Promise<StatePayload> {
  const [athlete, blocks, efforts, sessions, logs, meta] = await Promise.all([
    db.athlete.get(1),
    db.blocks.toArray(),
    db.efforts.toArray(),
    db.sessions.toArray(),
    db.logs.toArray(),
    db.meta.get(1),
  ]);
  return {
    updatedAt: meta?.lastModifiedAt ?? new Date(0).toISOString(),
    athlete: athlete ?? null,
    blocks,
    efforts,
    sessions,
    logs,
  };
}

// Replaces every local table wholesale with the server's snapshot. Meta is
// stamped from the payload itself (not "now"), so a later local edit is
// still correctly seen as newer than what we just imported.
async function importRemoteState(state: StatePayload): Promise<void> {
  await db.transaction('rw', [db.athlete, db.blocks, db.efforts, db.sessions, db.logs, db.meta], async () => {
    await db.athlete.clear();
    if (state.athlete) await db.athlete.put(state.athlete);
    await db.blocks.clear();
    await db.blocks.bulkPut(state.blocks);
    await db.efforts.clear();
    await db.efforts.bulkPut(state.efforts);
    await db.sessions.clear();
    await db.sessions.bulkPut(state.sessions);
    await db.logs.clear();
    await db.logs.bulkPut(state.logs);
    await db.meta.put({ id: 1, lastModifiedAt: state.updatedAt });
  });
  localStorage.setItem(LAST_SYNCED_KEY, state.updatedAt);
}

/** Pushes the current local state. On a 409 (server has something newer), pulls instead. */
export async function pushState(getToken: GetToken): Promise<void> {
  const payload = await exportLocalState();
  const res = await authedFetch('/api/state', getToken, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (res.status === 409) {
    const fresh = await authedFetch('/api/state', getToken);
    if (fresh.ok) {
      const remote: StatePayload | null = await fresh.json();
      if (remote) await importRemoteState(remote);
    }
    return;
  }

  if (!res.ok) throw new Error(`PUT /api/state failed: ${res.status}`);
  const { updatedAt } = (await res.json()) as { updatedAt: string };
  localStorage.setItem(LAST_SYNCED_KEY, updatedAt);
}

/**
 * Runs once per sign-in. Import-on-first-login: if the server has no state
 * yet for this account, whatever's on this device becomes the seed. If the
 * server already has state, whichever side changed most recently wins.
 */
export async function runInitialSync(getToken: GetToken): Promise<void> {
  const res = await authedFetch('/api/state', getToken);
  if (!res.ok) throw new Error(`GET /api/state failed: ${res.status}`);
  const remote: StatePayload | null = await res.json();
  const local = await exportLocalState();

  if (remote === null) {
    if (local.athlete || local.blocks.length > 0) {
      await pushState(getToken);
    }
    return;
  }

  if (new Date(local.updatedAt) > new Date(remote.updatedAt)) {
    await pushState(getToken);
  } else {
    await importRemoteState(remote);
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let tokenGetter: GetToken | null = null;

function scheduleDebouncedPush(): void {
  if (!tokenGetter) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  const getToken = tokenGetter;
  debounceTimer = setTimeout(() => {
    pushState(getToken).catch((err) => console.error('sync push failed', err));
  }, DEBOUNCE_MS);
}

// Wires local writes to a debounced push. Call once per sign-in (idempotent —
// hooking twice would double-fire, so main.tsx only calls this from a single
// top-level effect keyed on the signed-in user id).
let hooked = false;

export function initSync(getToken: GetToken): void {
  tokenGetter = getToken;
  if (hooked) return;
  hooked = true;
  db.meta.hook('creating', scheduleDebouncedPush);
  db.meta.hook('updating', scheduleDebouncedPush);
}

export function stopSync(): void {
  tokenGetter = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}
