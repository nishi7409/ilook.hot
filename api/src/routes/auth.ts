import { Hono } from 'hono';
import { hash, verify } from '@node-rs/argon2';
import { eq } from 'drizzle-orm';
import { generateIdFromEntropySize } from 'lucia';
import { lucia } from '../auth/lucia.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import type { AuthEnv } from '../middleware/auth.js';
import { authMiddleware } from '../middleware/auth.js';

const auth = new Hono<AuthEnv>();
auth.use('*', authMiddleware);

// POST /api/auth/signup
auth.post('/signup', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const email = body.email?.toLowerCase().trim();
  const password = body.password;

  if (!email || !password || password.length < 8) {
    return c.json({ error: 'Email and password (min 8 chars) required' }, 400);
  }

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) return c.json({ error: 'Email already in use' }, 409);

  const id = generateIdFromEntropySize(10);
  const hashedPassword = await hash(password, { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
  // Generate a unique calendar hash for iCal URLs
  const calendarHash = generateIdFromEntropySize(20);

  await db.insert(users).values({ id, email, hashedPassword, calendarHash });

  const session = await lucia.createSession(id, {});
  const cookie = lucia.createSessionCookie(session.id);
  c.header('Set-Cookie', cookie.serialize(), { append: true });

  return c.json({ id, email, calendarHash }, 201);
});

// POST /api/auth/signin
auth.post('/signin', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const email = body.email?.toLowerCase().trim();
  const password = body.password;

  if (!email || !password) return c.json({ error: 'Email and password required' }, 400);

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);

  const valid = await verify(user.hashedPassword, password);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  const session = await lucia.createSession(user.id, {});
  const cookie = lucia.createSessionCookie(session.id);
  c.header('Set-Cookie', cookie.serialize(), { append: true });

  return c.json({ id: user.id, email: user.email, calendarHash: user.calendarHash });
});

// POST /api/auth/signout
auth.post('/signout', async (c) => {
  const sessionId = c.get('sessionId');
  if (sessionId) await lucia.invalidateSession(sessionId);
  const cookie = lucia.createBlankSessionCookie();
  c.header('Set-Cookie', cookie.serialize(), { append: true });
  return c.json({ ok: true });
});

// GET /api/auth/me
auth.get('/me', (c) => {
  const user = c.get('user');
  if (!user) return c.json({ user: null });
  return c.json({ user });
});

export default auth;
