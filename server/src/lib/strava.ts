import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { blocks, sessionLogs, stravaAccounts, users } from '../db/schema.js';
import { env } from '../env.js';
import { decryptSecret, encryptSecret } from './crypto.js';

const OAUTH_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const OAUTH_TOKEN_URL = 'https://www.strava.com/oauth/token';
const OAUTH_DEAUTHORIZE_URL = 'https://www.strava.com/oauth/deauthorize';
const API_BASE = 'https://www.strava.com/api/v3';

// Refresh this many seconds before actual expiry, so a slightly-slow request
// never hands the caller a token that expires mid-flight.
const REFRESH_SKEW_SECONDS = 60;

function requireConfig() {
  if (!env.STRAVA_CLIENT_ID || !env.STRAVA_CLIENT_SECRET) {
    throw new Error('STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET are not set');
  }
  return { clientId: env.STRAVA_CLIENT_ID, clientSecret: env.STRAVA_CLIENT_SECRET };
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { clientId } = requireConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    approval_prompt: 'auto',
    scope: env.STRAVA_SCOPE,
    state,
  });
  return `${OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: { id: number };
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const { clientId, clientSecret } = requireConfig();
  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, ...body }),
  });
  if (!res.ok) {
    throw new Error(`Strava token request failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export async function exchangeCodeForToken(code: string): Promise<TokenResponse> {
  return postToken({ code, grant_type: 'authorization_code' });
}

async function refreshToken(refreshTokenValue: string): Promise<TokenResponse> {
  return postToken({ refresh_token: refreshTokenValue, grant_type: 'refresh_token' });
}

/** Stores tokens encrypted, upserting on the athlete's userId. */
export async function saveTokens(userId: string, token: TokenResponse): Promise<void> {
  if (!db) throw new Error('DATABASE_URL is not set');
  if (!token.athlete) throw new Error('Strava token response missing athlete id');
  await db
    .insert(stravaAccounts)
    .values({
      userId,
      stravaAthleteId: token.athlete.id,
      accessTokenEncrypted: encryptSecret(token.access_token),
      refreshTokenEncrypted: encryptSecret(token.refresh_token),
      expiresAt: new Date(token.expires_at * 1000),
      scope: env.STRAVA_SCOPE,
    })
    .onConflictDoUpdate({
      target: stravaAccounts.userId,
      set: {
        stravaAthleteId: token.athlete.id,
        accessTokenEncrypted: encryptSecret(token.access_token),
        refreshTokenEncrypted: encryptSecret(token.refresh_token),
        expiresAt: new Date(token.expires_at * 1000),
        scope: env.STRAVA_SCOPE,
        updatedAt: sql`now()`,
      },
    });
}

/**
 * Returns a valid access token for this user, refreshing on-demand if the
 * stored one is expired (or about to be) — no background job, since a
 * serverless function has nowhere to run one. Returns null if the user
 * hasn't connected Strava.
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  if (!db) throw new Error('DATABASE_URL is not set');
  const [account] = await db.select().from(stravaAccounts).where(eq(stravaAccounts.userId, userId));
  if (!account) return null;

  const expiresInSeconds = (account.expiresAt.getTime() - Date.now()) / 1000;
  if (expiresInSeconds > REFRESH_SKEW_SECONDS) {
    return decryptSecret(account.accessTokenEncrypted);
  }

  const refreshed = await refreshToken(decryptSecret(account.refreshTokenEncrypted));
  await db
    .update(stravaAccounts)
    .set({
      accessTokenEncrypted: encryptSecret(refreshed.access_token),
      refreshTokenEncrypted: encryptSecret(refreshed.refresh_token),
      expiresAt: new Date(refreshed.expires_at * 1000),
      updatedAt: sql`now()`,
    })
    .where(eq(stravaAccounts.userId, userId));
  return refreshed.access_token;
}

/** Best-effort — the account row is deleted either way. */
export async function deauthorize(accessToken: string): Promise<void> {
  try {
    await fetch(OAUTH_DEAUTHORIZE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: accessToken }),
    });
  } catch (err) {
    console.error('Strava deauthorize call failed (continuing anyway)', err);
  }
}

export interface StravaActivity {
  id: number;
  type: string;
  sport_type?: string;
  start_date_local: string; // ISO
  moving_time: number; // seconds
  distance: number; // meters
  name?: string;
}

export async function fetchActivities(accessToken: string, afterEpochSeconds: number, perPage = 50): Promise<StravaActivity[]> {
  const params = new URLSearchParams({ after: String(afterEpochSeconds), per_page: String(perPage) });
  const res = await fetch(`${API_BASE}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava activities request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<StravaActivity[]>;
}

export async function fetchActivity(accessToken: string, activityId: number): Promise<StravaActivity> {
  const res = await fetch(`${API_BASE}/activities/${activityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Strava activity request failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<StravaActivity>;
}

// Strava's `type`/`sport_type` vocabulary is much larger than our Discipline
// set — this covers the common ones and leaves the rest unmapped (still
// logged, just without a discipline badge) rather than guessing.
const TYPE_TO_DISCIPLINE: Record<string, string> = {
  Run: 'running', TrailRun: 'running', VirtualRun: 'running',
  Ride: 'cycling', VirtualRide: 'cycling', GravelRide: 'cycling', MountainBikeRide: 'cycling', EBikeRide: 'cycling',
  Swim: 'swimming',
  Rowing: 'rowing', VirtualRow: 'rowing', Kayaking: 'rowing', Canoeing: 'rowing',
  Walk: 'walking', Hike: 'walking',
  WeightTraining: 'lifting', Workout: 'lifting', Crossfit: 'lifting',
};

export function mapActivityTypeToDiscipline(activity: StravaActivity): string | null {
  return TYPE_TO_DISCIPLINE[activity.sport_type ?? activity.type] ?? null;
}

async function bumpWatermark(userId: string): Promise<void> {
  if (!db) return;
  await db.update(users).set({ stateUpdatedAt: sql`now()` }).where(eq(users.id, userId));
}

/**
 * Inserts or updates the sessionLog for one Strava activity, attached to the
 * user's current active block. No-ops if there's no active block — an
 * activity with nothing to attach to isn't useful to the planner yet.
 */
export async function upsertActivityLog(userId: string, activity: StravaActivity): Promise<void> {
  if (!db) throw new Error('DATABASE_URL is not set');
  const [activeBlock] = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(and(eq(blocks.userId, userId), eq(blocks.status, 'active')));
  if (!activeBlock) return;

  const discipline = mapActivityTypeToDiscipline(activity);
  const date = activity.start_date_local.slice(0, 10);

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: sessionLogs.id })
      .from(sessionLogs)
      .where(eq(sessionLogs.stravaActivityId, activity.id));

    if (existing) {
      await tx
        .update(sessionLogs)
        .set({
          date,
          actualDurationSeconds: activity.moving_time,
          actualDistanceMeters: activity.distance,
          discipline,
          updatedAt: sql`now()`,
        })
        .where(eq(sessionLogs.id, existing.id));
    } else {
      await tx.insert(sessionLogs).values({
        id: crypto.randomUUID(),
        userId,
        blockId: activeBlock.id,
        sessionId: null,
        date,
        actualReps: null,
        actualDurationSeconds: activity.moving_time,
        actualDistanceMeters: activity.distance,
        recoveryScore: null,
        sleepHours: null,
        temperatureC: null,
        rpe: null,
        note: activity.name ?? null,
        cutShortReason: null,
        discipline,
        stravaActivityId: activity.id,
      });
    }
    await tx.update(users).set({ stateUpdatedAt: sql`now()` }).where(eq(users.id, userId));
  });
}

/** Used by the webhook's delete event. Looks up the owning user itself. */
export async function deleteActivityLog(stravaActivityId: number): Promise<void> {
  if (!db) throw new Error('DATABASE_URL is not set');
  const [log] = await db
    .select({ id: sessionLogs.id, userId: sessionLogs.userId })
    .from(sessionLogs)
    .where(eq(sessionLogs.stravaActivityId, stravaActivityId));
  if (!log) return;

  await db.transaction(async (tx) => {
    await tx.delete(sessionLogs).where(eq(sessionLogs.id, log.id));
    await tx.update(users).set({ stateUpdatedAt: sql`now()` }).where(eq(users.id, log.userId));
  });
}

export async function findUserByStravaAthleteId(athleteId: number): Promise<string | null> {
  if (!db) throw new Error('DATABASE_URL is not set');
  const [account] = await db
    .select({ userId: stravaAccounts.userId })
    .from(stravaAccounts)
    .where(eq(stravaAccounts.stravaAthleteId, athleteId));
  return account?.userId ?? null;
}

export async function disconnectAccount(userId: string): Promise<void> {
  if (!db) throw new Error('DATABASE_URL is not set');
  const [account] = await db.select().from(stravaAccounts).where(eq(stravaAccounts.userId, userId));
  if (account) {
    await deauthorize(decryptSecret(account.accessTokenEncrypted));
  }
  await db.delete(stravaAccounts).where(eq(stravaAccounts.userId, userId));
  await bumpWatermark(userId);
}

/** Backfills recent activities on connect. Best-effort per activity. */
export async function backfillRecentActivities(userId: string, accessToken: string, days = 30): Promise<void> {
  const after = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
  const activities = await fetchActivities(accessToken, after, 50);
  for (const activity of activities) {
    try {
      await upsertActivityLog(userId, activity);
    } catch (err) {
      console.error(`Strava backfill: failed to import activity ${activity.id}`, err);
    }
  }
}
