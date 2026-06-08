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

// GET /search?q=...
router.get('/search', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const q = c.req.query('q')?.trim();
  if (!q) return c.json([]);

  const [offResults, usdaResults] = await Promise.allSettled([
    fetchOpenFoodFacts(q),
    fetchUSDA(q),
  ]);

  const foods = [
    ...(offResults.status === 'fulfilled' ? offResults.value : []),
    ...(usdaResults.status === 'fulfilled' ? usdaResults.value : []),
  ];

  return c.json(foods);
});

interface NormalizedFood {
  id: string;
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  barcode?: string;
  source: 'openfoodfacts' | 'usda';
}

async function fetchOpenFoodFacts(query: string): Promise<NormalizedFood[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=20`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    products?: Array<{
      code?: string;
      product_name?: string;
      brands?: string;
      serving_quantity?: number;
      serving_size?: string;
      nutriments?: {
        'energy-kcal_100g'?: number;
        proteins_100g?: number;
        carbohydrates_100g?: number;
        fat_100g?: number;
      };
    }>;
  };

  return (data.products ?? [])
    .filter((p) => p.product_name && p.nutriments?.['energy-kcal_100g'] != null)
    .map((p) => ({
      id: `off-${p.code ?? crypto.randomUUID()}`,
      name: p.product_name!,
      brand: p.brands || undefined,
      servingSize: p.serving_quantity ?? 100,
      servingUnit: p.serving_size ? parseServingUnit(p.serving_size) : 'g',
      calories: Math.round(p.nutriments!['energy-kcal_100g'] ?? 0),
      protein: round1(p.nutriments!.proteins_100g ?? 0),
      carbs: round1(p.nutriments!.carbohydrates_100g ?? 0),
      fat: round1(p.nutriments!.fat_100g ?? 0),
      barcode: p.code || undefined,
      source: 'openfoodfacts' as const,
    }));
}

async function fetchUSDA(query: string): Promise<NormalizedFood[]> {
  const apiKey = process.env['USDA_API_KEY'] ?? 'DEMO_KEY';
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${apiKey}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    foods?: Array<{
      fdcId?: number;
      description?: string;
      brandName?: string;
      brandOwner?: string;
      servingSize?: number;
      servingSizeUnit?: string;
      foodNutrients?: Array<{
        nutrientId?: number;
        nutrientName?: string;
        value?: number;
      }>;
    }>;
  };

  return (data.foods ?? [])
    .filter((f) => f.description)
    .map((f) => {
      const nutrients = f.foodNutrients ?? [];
      const getNutrient = (id: number) => nutrients.find((n) => n.nutrientId === id)?.value ?? 0;
      return {
        id: `usda-${f.fdcId ?? crypto.randomUUID()}`,
        name: f.description!,
        brand: f.brandName || f.brandOwner || undefined,
        servingSize: f.servingSize ?? 100,
        servingUnit: f.servingSizeUnit ?? 'g',
        calories: Math.round(getNutrient(1008)),
        protein: round1(getNutrient(1003)),
        carbs: round1(getNutrient(1005)),
        fat: round1(getNutrient(1004)),
        source: 'usda' as const,
      };
    });
}

function parseServingUnit(servingSize: string): string {
  const match = servingSize.match(/[a-zA-Z]+/);
  return match ? match[0].toLowerCase() : 'g';
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

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
