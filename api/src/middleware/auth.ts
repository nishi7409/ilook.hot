import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { lucia } from '../auth/lucia.js';

export type AuthEnv = {
  Variables: {
    user: { id: string; email: string; calendarHash: string } | null;
    sessionId: string | null;
  };
};

export async function authMiddleware(c: Context<AuthEnv>, next: Next): Promise<Response | void> {
  const sessionId = getCookie(c, lucia.sessionCookieName) ?? null;

  if (!sessionId) {
    c.set('user', null);
    c.set('sessionId', null);
    return next();
  }

  const { session, user } = await lucia.validateSession(sessionId);

  if (session?.fresh) {
    const cookie = lucia.createSessionCookie(session.id);
    c.header('Set-Cookie', cookie.serialize(), { append: true });
  }
  if (!session) {
    const cookie = lucia.createBlankSessionCookie();
    c.header('Set-Cookie', cookie.serialize(), { append: true });
    c.set('user', null);
    c.set('sessionId', null);
    return next();
  }

  c.set('user', { id: user.id, email: user.email, calendarHash: user.calendarHash });
  c.set('sessionId', session.id);
  return next();
}

export function requireAuth(c: Context<AuthEnv>) {
  const user = c.get('user');
  if (!user) return c.json({ error: 'Unauthorized' }, 401);
  return null;
}
