import { Hono } from 'hono';
import { and, eq, desc, sum } from 'drizzle-orm';
import { db } from '../db/index.js';
import { waterLogs, waterGoals } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthEnv } from '../middleware/auth.js';

const router = new Hono<AuthEnv>();

// GET / ?date=yyyy-MM-dd — get water entries + total for a date
router.get('/', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;
  const date = c.req.query('date') ?? new Date().toISOString().slice(0, 10);

  const entries = await db
    .select()
    .from(waterLogs)
    .where(and(eq(waterLogs.userId, user.id), eq(waterLogs.date, date)))
    .orderBy(desc(waterLogs.createdAt));

  const total = entries.reduce((acc, e) => acc + e.amount, 0);

  return c.json({ entries, total });
});

// POST / — add water entry
router.post('/', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const body = await c.req.json<{ amount: number; date: string }>();
  if (!body.amount || body.amount <= 0) return c.json({ error: 'Invalid amount' }, 400);
  if (!body.date) return c.json({ error: 'Date is required' }, 400);

  const id = crypto.randomUUID();

  await db.insert(waterLogs).values({
    id,
    userId: user.id,
    date: body.date,
    amount: body.amount,
  });

  const row = await db.select().from(waterLogs).where(eq(waterLogs.id, id)).then((r) => r[0]);
  return c.json(row, 201);
});

// DELETE /:id — remove entry
router.delete('/:id', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;
  const id = c.req.param('id');

  const existing = await db
    .select()
    .from(waterLogs)
    .where(and(eq(waterLogs.id, id), eq(waterLogs.userId, user.id)))
    .then((r) => r[0]);

  if (!existing) return c.json({ error: 'Not found' }, 404);

  await db.delete(waterLogs).where(eq(waterLogs.id, id));
  return c.json({ success: true });
});

// GET /goals — get daily goal
router.get('/goals', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const row = await db
    .select()
    .from(waterGoals)
    .where(eq(waterGoals.userId, user.id))
    .then((r) => r[0]);

  return c.json({ dailyGoalMl: row?.dailyGoalMl ?? 2500 });
});

// PUT /goals — update daily goal
router.put('/goals', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const body = await c.req.json<{ dailyGoalMl: number }>();
  if (!body.dailyGoalMl || body.dailyGoalMl <= 0) return c.json({ error: 'Invalid goal' }, 400);

  await db
    .insert(waterGoals)
    .values({ userId: user.id, dailyGoalMl: body.dailyGoalMl })
    .onConflictDoUpdate({
      target: waterGoals.userId,
      set: { dailyGoalMl: body.dailyGoalMl },
    });

  return c.json({ dailyGoalMl: body.dailyGoalMl });
});

export default router;
