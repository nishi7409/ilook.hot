import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { daySchedules, programs } from '../db/schema.js';
import type { AuthEnv } from '../middleware/auth.js';
import { authMiddleware, requireAuth } from '../middleware/auth.js';

const router = new Hono<AuthEnv>();
router.use('*', authMiddleware);

function mapSchedule(s: typeof daySchedules.$inferSelect) {
  return {
    id: s.id,
    programId: s.programId,
    dayId: s.dayId,
    dayName: s.dayName,
    startDate: s.startDate,
    frequencyCount: s.frequencyCount,
    frequencyUnit: s.frequencyUnit as 'day' | 'week' | 'month',
    endDate: s.endDate ?? undefined,
    excludedDates: s.excludedDates ?? [],
  };
}

// GET /api/schedules
router.get('/', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  // Get all program IDs for this user
  const userPrograms = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.userId, user.id));

  if (userPrograms.length === 0) return c.json([]);

  const allSchedules = (
    await Promise.all(
      userPrograms.map((p) =>
        db.select().from(daySchedules).where(eq(daySchedules.programId, p.id)),
      ),
    )
  ).flat();

  return c.json(allSchedules.map(mapSchedule));
});

// POST /api/schedules
router.post('/', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  const body = await c.req.json<{
    programId: string;
    entries: Array<{
      dayId: string;
      dayName: string;
      startDate: string;
      frequencyCount: number;
      frequencyUnit: 'day' | 'week' | 'month';
      endDate?: string;
      excludedDates?: string[];
    }>;
  }>();

  // Verify program belongs to user
  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, body.programId), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Program not found' }, 404);

  // Delete existing schedules for this program
  await db.delete(daySchedules).where(eq(daySchedules.programId, body.programId));

  if (body.entries.length === 0) return c.json([]);

  const now = new Date();
  const rows = body.entries.map((e) => ({
    id: crypto.randomUUID(),
    programId: body.programId,
    dayId: e.dayId,
    dayName: e.dayName,
    startDate: e.startDate,
    frequencyCount: e.frequencyCount,
    frequencyUnit: e.frequencyUnit,
    endDate: e.endDate ?? null,
    excludedDates: e.excludedDates ?? [],
    createdAt: now,
  }));

  await db.insert(daySchedules).values(rows);

  const inserted = await db
    .select()
    .from(daySchedules)
    .where(eq(daySchedules.programId, body.programId));

  return c.json(inserted.map(mapSchedule), 201);
});

// DELETE /api/schedules/:id  (remove entire schedule entry)
router.delete('/:id', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  // Skip if it's a sub-route like /occurrence or /from-date (handled by later routes)
  const [sched] = await db
    .select()
    .from(daySchedules)
    .where(eq(daySchedules.id, id))
    .limit(1);
  if (!sched) return c.json({ error: 'Not found' }, 404);

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, sched.programId), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Unauthorized' }, 401);

  await db.delete(daySchedules).where(eq(daySchedules.id, id));
  return c.json({ ok: true });
});

// DELETE /api/schedules/:id/occurrence
router.delete('/:id/occurrence', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  const [sched] = await db
    .select()
    .from(daySchedules)
    .where(eq(daySchedules.id, id))
    .limit(1);
  if (!sched) return c.json({ error: 'Not found' }, 404);

  // Verify ownership via program
  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, sched.programId), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<{ date: string }>();
  const excluded = [...(sched.excludedDates ?? []), body.date];

  await db
    .update(daySchedules)
    .set({ excludedDates: excluded })
    .where(eq(daySchedules.id, id));

  const [updated] = await db
    .select()
    .from(daySchedules)
    .where(eq(daySchedules.id, id))
    .limit(1);

  return c.json(mapSchedule(updated));
});

// DELETE /api/schedules/:id/from-date
router.delete('/:id/from-date', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  const [sched] = await db
    .select()
    .from(daySchedules)
    .where(eq(daySchedules.id, id))
    .limit(1);
  if (!sched) return c.json({ error: 'Not found' }, 404);

  // Verify ownership via program
  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, sched.programId), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json<{ date: string }>();

  // If cutting at the very start, delete the whole entry
  if (sched.startDate === body.date) {
    await db.delete(daySchedules).where(eq(daySchedules.id, id));
    return c.json({ ok: true, deleted: true });
  }

  await db
    .update(daySchedules)
    .set({ endDate: body.date })
    .where(eq(daySchedules.id, id));

  const [updated] = await db
    .select()
    .from(daySchedules)
    .where(eq(daySchedules.id, id))
    .limit(1);

  return c.json(mapSchedule(updated));
});

export default router;
