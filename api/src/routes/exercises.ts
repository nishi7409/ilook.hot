import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { exercises } from '../db/schema.js';

const router = new Hono();

// GET /api/exercises — public reference data, no auth required
router.get('/', async (c) => {
  const all = await db
    .select()
    .from(exercises)
    .orderBy(asc(exercises.group), asc(exercises.sortOrder));

  return c.json(
    all.map((e) => ({
      id: e.id,
      name: e.name,
      muscleGroups: e.muscleGroups,
      category: e.category,
      group: e.group,
      topRated: e.topRated,
      demoUrl: e.demoUrl ?? null,
    })),
  );
});

export default router;
