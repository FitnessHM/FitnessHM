import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../env.js';
import { getAuth, requireUser } from '../lib/auth.js';
import {
  backfillRecentActivities,
  buildAuthorizeUrl,
  deleteActivityLog,
  disconnectAccount,
  exchangeCodeForToken,
  fetchActivity,
  findUserByStravaAthleteId,
  getConnectionStatus,
  getValidAccessToken,
  saveTokens,
  upsertActivityLog,
} from '../lib/strava.js';

const STATE_COOKIE = 'strava_oauth_state';

function redirectUri(): string {
  return `${env.APP_BASE_URL}/api/strava/callback`;
}

// Minimal manual cookie handling — one short-lived CSRF-state value, not
// worth adding cookie-parser for.
function readCookie(req: { headers: { cookie?: string } }, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

export const stravaRouter = Router();

stravaRouter.get('/api/strava/status', requireUser, async (req, res) => {
  const { userId } = getAuth(req);
  const status = await getConnectionStatus(userId!);
  res.json(status);
});

stravaRouter.post('/api/strava/sync', requireUser, async (req, res) => {
  const { userId } = getAuth(req);
  const accessToken = await getValidAccessToken(userId!);
  if (!accessToken) {
    res.status(409).json({ error: 'not_connected' });
    return;
  }
  await backfillRecentActivities(userId!, accessToken);
  const status = await getConnectionStatus(userId!);
  res.json(status);
});

stravaRouter.get('/api/strava/connect', requireUser, (_req, res) => {
  const state = randomBytes(16).toString('hex');
  res.setHeader(
    'Set-Cookie',
    `${STATE_COOKIE}=${state}; Path=/api/strava; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );
  res.redirect(buildAuthorizeUrl(redirectUri(), state));
});

const callbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

stravaRouter.get('/api/strava/callback', requireUser, async (req, res) => {
  const clearCookie = `${STATE_COOKIE}=; Path=/api/strava; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  const { userId } = getAuth(req);
  const parsed = callbackQuerySchema.safeParse(req.query);
  const query = parsed.success ? parsed.data : {};

  if (query.error) {
    // User declined on Strava's consent screen — not an error we need to log.
    res.setHeader('Set-Cookie', clearCookie);
    res.redirect('/?strava=denied');
    return;
  }

  const expectedState = readCookie(req, STATE_COOKIE);
  if (!query.code || !query.state || !expectedState || query.state !== expectedState) {
    res.setHeader('Set-Cookie', clearCookie);
    res.status(400).json({ error: 'invalid_oauth_state' });
    return;
  }

  try {
    const token = await exchangeCodeForToken(query.code);
    await saveTokens(userId!, token);
    const accessToken = await getValidAccessToken(userId!);
    if (accessToken) {
      await backfillRecentActivities(userId!, accessToken);
    }
    res.setHeader('Set-Cookie', clearCookie);
    res.redirect('/?strava=connected');
  } catch (err) {
    console.error('Strava callback failed', err);
    res.setHeader('Set-Cookie', clearCookie);
    res.redirect('/?strava=error');
  }
});

stravaRouter.post('/api/strava/disconnect', requireUser, async (req, res) => {
  const { userId } = getAuth(req);
  await disconnectAccount(userId!);
  res.json({ ok: true });
});

// --- Webhook: no Clerk session (Strava calls this directly), authenticated
// instead by the verify token Strava echoes back / was configured with. ---

const webhookChallengeSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string(),
});

stravaRouter.get('/api/strava/webhook', (req, res) => {
  const parsed = webhookChallengeSchema.safeParse(req.query);
  if (!parsed.success || parsed.data['hub.verify_token'] !== env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    res.status(403).json({ error: 'invalid_verify_token' });
    return;
  }
  res.json({ 'hub.challenge': parsed.data['hub.challenge'] });
});

const webhookEventSchema = z.object({
  aspect_type: z.enum(['create', 'update', 'delete']),
  object_type: z.enum(['activity', 'athlete']),
  object_id: z.number(),
  owner_id: z.number(),
  updates: z.record(z.string(), z.string()).optional(),
});

stravaRouter.post('/api/strava/webhook', async (req, res) => {
  // Ack immediately — Strava expects a fast 200 and retries on timeout/error.
  res.status(200).json({ ok: true });

  const parsed = webhookEventSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error('Strava webhook: unrecognized payload', parsed.error.issues);
    return;
  }
  const event = parsed.data;

  try {
    if (event.object_type === 'athlete') {
      if (event.updates?.authorized === 'false') {
        const userId = await findUserByStravaAthleteId(event.owner_id);
        if (userId) await disconnectAccount(userId);
      }
      return;
    }

    if (event.aspect_type === 'delete') {
      await deleteActivityLog(event.object_id);
      return;
    }

    const userId = await findUserByStravaAthleteId(event.owner_id);
    if (!userId) return;
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) return;
    const activity = await fetchActivity(accessToken, event.object_id);
    await upsertActivityLog(userId, activity);
  } catch (err) {
    console.error('Strava webhook: failed to process event', event, err);
  }
});
