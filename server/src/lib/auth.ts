import { clerkMiddleware, getAuth } from '@clerk/express';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../env.js';

// Decorates every request with req.auth() from the Clerk session JWT (or
// leaves it unsigned). Must run before requireUser.
export const withClerkAuth = clerkMiddleware({
  secretKey: env.CLERK_SECRET_KEY,
  publishableKey: env.CLERK_PUBLISHABLE_KEY,
});

// Rejects unauthenticated requests with 401 JSON (not Clerk's default
// sign-in redirect, which makes no sense for an API).
export function requireUser(req: Request, res: Response, next: NextFunction) {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}

export { getAuth };
