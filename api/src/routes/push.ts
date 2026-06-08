import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import webpush from 'web-push';
import { db } from '../db/index.js';
import { pushSubscriptions } from '../db/schema.js';
import type { AuthEnv } from '../middleware/auth.js';
import { requireAuth } from '../middleware/auth.js';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@ilook.hot';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const router = new Hono<AuthEnv>();

// GET /api/push/vapid-key — public, no auth needed
router.get('/vapid-key', (c) => {
  if (!VAPID_PUBLIC_KEY) {
    return c.json({ error: 'Push notifications not configured' }, 503);
  }
  return c.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — save push subscription for authenticated user
router.post('/subscribe', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  const body = await c.req.json<{
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }>();

  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: 'Invalid subscription' }, 400);
  }

  // Upsert: delete existing subscriptions with same endpoint, then insert
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));

  const id = crypto.randomUUID();
  await db.insert(pushSubscriptions).values({
    id,
    userId: user.id,
    endpoint: body.endpoint,
    p256dh: body.keys.p256dh,
    auth: body.keys.auth,
    createdAt: new Date(),
  });

  return c.json({ ok: true, id });
});

// DELETE /api/push/subscribe — remove subscription
router.delete('/subscribe', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  const body = await c.req.json<{ endpoint: string }>();
  if (!body.endpoint) {
    return c.json({ error: 'Endpoint required' }, 400);
  }

  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, body.endpoint));
  return c.json({ ok: true });
});

// POST /api/push/test — send a test notification to the user
router.post('/test', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return c.json({ error: 'Push not configured' }, 503);
  }

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, user.id));

  if (subs.length === 0) {
    return c.json({ error: 'No subscriptions found' }, 404);
  }

  const payload = JSON.stringify({
    title: '🏋️ iLook.hot',
    body: 'Test notification — push is working!',
    url: '/workouts',
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired, clean up
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
      }
      console.error('Push send error:', err);
    }
  }

  return c.json({ ok: true, sent });
});

export default router;
