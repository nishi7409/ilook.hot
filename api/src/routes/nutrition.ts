import { Hono } from 'hono';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { nutritionLogs, nutritionGoals } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthEnv } from '../middleware/auth.js';

const router = new Hono<AuthEnv>();

// GET /log?date=yyyy-MM-dd  (defaults to today)
router.get('/log', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;
  const date = c.req.query('date') ?? new Date().toISOString().slice(0, 10);

  const entries = await db
    .select()
    .from(nutritionLogs)
    .where(and(eq(nutritionLogs.userId, user.id), eq(nutritionLogs.date, date)))
    .orderBy(desc(nutritionLogs.loggedAt));

  return c.json(entries.map(formatEntry));
});

// GET /weekly  — last 7 days totals
router.get('/weekly', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const today = new Date();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);
  const from = sevenDaysAgo.toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(nutritionLogs)
    .where(
      and(
        eq(nutritionLogs.userId, user.id),
        gte(nutritionLogs.date, from),
        lte(nutritionLogs.date, to),
      ),
    );

  // Group by date
  const byDate: Record<string, number> = {};
  for (const r of rows) {
    byDate[r.date] = (byDate[r.date] ?? 0) + parseFloat(r.calories);
  }

  return c.json(byDate);
});

// POST /log — add entry
router.post('/log', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const body = await c.req.json<{
    foodId: string;
    foodName: string;
    brand?: string;
    servingSize: number;
    servingUnit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    mealType: string;
    servings: number;
    date: string;
    source?: string;
  }>();

  const id = crypto.randomUUID();
  const loggedAt = new Date().toISOString();

  await db.insert(nutritionLogs).values({
    id,
    userId: user.id,
    date: body.date,
    foodId: body.foodId,
    foodName: body.foodName,
    brand: body.brand ?? null,
    servingSize: String(body.servingSize),
    servingUnit: body.servingUnit,
    calories: String(Math.round(body.calories * body.servings)),
    protein: String(+(body.protein * body.servings).toFixed(1)),
    carbs: String(+(body.carbs * body.servings).toFixed(1)),
    fat: String(+(body.fat * body.servings).toFixed(1)),
    mealType: body.mealType,
    servings: String(body.servings),
    loggedAt,
    source: body.source ?? 'custom',
  });

  const row = await db.select().from(nutritionLogs).where(eq(nutritionLogs.id, id)).then((r) => r[0]);
  return c.json(formatEntry(row), 201);
});

// DELETE /log/:id
router.delete('/log/:id', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;
  const id = c.req.param('id');

  const existing = await db
    .select()
    .from(nutritionLogs)
    .where(and(eq(nutritionLogs.id, id), eq(nutritionLogs.userId, user.id)))
    .then((r) => r[0]);

  if (!existing) return c.json({ error: 'Not found' }, 404);

  await db.delete(nutritionLogs).where(eq(nutritionLogs.id, id));
  return c.json({ success: true });
});

// GET /goals
router.get('/goals', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const row = await db
    .select()
    .from(nutritionGoals)
    .where(eq(nutritionGoals.userId, user.id))
    .then((r) => r[0]);

  return c.json(row ?? { calories: 2400, protein: 180, carbs: 250, fat: 80 });
});

// PUT /goals
router.put('/goals', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  const body = await c.req.json<{ calories: number; protein: number; carbs: number; fat: number }>();

  await db
    .insert(nutritionGoals)
    .values({ userId: user.id, ...body })
    .onConflictDoUpdate({
      target: nutritionGoals.userId,
      set: body,
    });

  return c.json(body);
});

function formatEntry(r: typeof nutritionLogs.$inferSelect) {
  return {
    id: r.id,
    date: r.date,
    food: {
      id: r.foodId,
      name: r.foodName,
      brand: r.brand ?? undefined,
      servingSize: parseFloat(r.servingSize),
      servingUnit: r.servingUnit,
      calories: parseFloat(r.calories) / parseFloat(r.servings),
      protein: parseFloat(r.protein) / parseFloat(r.servings),
      carbs: parseFloat(r.carbs) / parseFloat(r.servings),
      fat: parseFloat(r.fat) / parseFloat(r.servings),
      source: r.source,
    },
    mealType: r.mealType,
    servings: parseFloat(r.servings),
    calories: parseFloat(r.calories),
    protein: parseFloat(r.protein),
    carbs: parseFloat(r.carbs),
    fat: parseFloat(r.fat),
    loggedAt: r.loggedAt,
  };
}

export default router;
