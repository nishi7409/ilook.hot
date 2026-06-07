import { Hono } from 'hono';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { programs, programDays, programDayExercises, daySchedules } from '../db/schema.js';
import type { AuthEnv } from '../middleware/auth.js';
import { authMiddleware, requireAuth } from '../middleware/auth.js';
import { PROGRAM_TEMPLATES } from '../data/program-templates.js';

const router = new Hono<AuthEnv>();
router.use('*', authMiddleware);

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fetchProgramWithDays(programId: string) {
  const [prog] = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  if (!prog) return null;

  const days = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .orderBy(asc(programDays.sortOrder));

  // Fetch exercises per day to avoid complex IN clause without helper
  const dayIds = days.map((d) => d.id);
  let allExercises: (typeof programDayExercises.$inferSelect)[] = [];
  if (dayIds.length > 0) {
    // Fetch all exercises for these days
    const results = await Promise.all(
      dayIds.map((dayId) =>
        db
          .select()
          .from(programDayExercises)
          .where(eq(programDayExercises.dayId, dayId))
          .orderBy(asc(programDayExercises.sortOrder)),
      ),
    );
    allExercises = results.flat();
  }

  const exercisesByDay = new Map<string, (typeof programDayExercises.$inferSelect)[]>();
  for (const ex of allExercises) {
    const list = exercisesByDay.get(ex.dayId) ?? [];
    list.push(ex);
    exercisesByDay.set(ex.dayId, list);
  }

  return {
    id: prog.id,
    name: prog.name,
    description: prog.description ?? undefined,
    isActive: prog.isActive,
    startDate: prog.startDate ?? undefined,
    createdAt: prog.createdAt.toISOString(),
    updatedAt: prog.updatedAt.toISOString(),
    days: days.map((d) => ({
      id: d.id,
      name: d.name,
      isRest: d.isRest,
      exercises: (exercisesByDay.get(d.id) ?? []).map((e) => ({
        rowId: e.id,
        exerciseId: e.exerciseId,
        exercise: {
          id: e.exerciseId,
          name: e.exerciseName,
          muscleGroups: e.muscleGroups,
          category: e.category,
        },
        sets: e.sets,
        reps: e.reps,
        weight: parseFloat(e.weight),
        weightUnit: e.weightUnit as 'lbs' | 'kg',
        restSeconds: e.restSeconds ?? undefined,
        notes: e.notes ?? undefined,
      })),
    })),
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/programs
router.get('/', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  const userPrograms = await db
    .select()
    .from(programs)
    .where(eq(programs.userId, user.id))
    .orderBy(asc(programs.createdAt));

  const result = await Promise.all(userPrograms.map((p) => fetchProgramWithDays(p.id)));
  return c.json(result.filter(Boolean));
});

// POST /api/programs
router.post('/', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  const body = await c.req.json<{ name: string; description?: string }>();
  if (!body.name?.trim()) return c.json({ error: 'Name required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(programs).values({
    id,
    userId: user.id,
    name: body.name.trim(),
    description: body.description ?? null,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  });

  // Create a default first day
  const dayId = crypto.randomUUID();
  await db.insert(programDays).values({
    id: dayId,
    programId: id,
    name: 'Day 1',
    isRest: false,
    sortOrder: 0,
  });

  const prog = await fetchProgramWithDays(id);
  return c.json(prog, 201);
});

// GET /api/programs/templates  — list available templates (no auth required)
router.get('/templates', async (c) => {
  return c.json(
    PROGRAM_TEMPLATES.map(({ key, name, description, split, daysPerWeek, days }) => {
      // Compute volume summary: total sets per primary muscle group
      const totals = new Map<string, number>();
      for (const day of days) {
        if (day.isRest) continue;
        for (const ex of day.exercises) {
          const primary = ex.muscleGroups[0];
          if (!primary) continue;
          totals.set(primary, (totals.get(primary) ?? 0) + ex.sets);
        }
      }
      const max = totals.size ? Math.max(...totals.values()) : 1;
      const volumeSummary = Array.from(totals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([group, sets]) => ({ group, sets, pct: Math.round((sets / max) * 100) }));

      return {
        key,
        name,
        description,
        split,
        daysPerWeek,
        days: days.map((d) => ({ name: d.name, isRest: d.isRest ?? false, exerciseCount: d.exercises.length })),
        volumeSummary,
      };
    }),
  );
});

// POST /api/programs/from-template
router.post('/from-template', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  const body = await c.req.json<{ template: string; name?: string }>();
  const tmpl = PROGRAM_TEMPLATES.find((t) => t.key === body.template);
  if (!tmpl) return c.json({ error: 'Unknown template' }, 400);

  const programId = crypto.randomUUID();
  const now = new Date();
  const programName = (body.name?.trim()) || tmpl.name;

  await db.insert(programs).values({
    id: programId,
    userId: user.id,
    name: programName,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  });

  for (let di = 0; di < tmpl.days.length; di++) {
    const day = tmpl.days[di];
    const dayId = crypto.randomUUID();
    await db.insert(programDays).values({
      id: dayId,
      programId,
      name: day.name,
      isRest: day.isRest ?? false,
      sortOrder: di,
    });

    for (let ei = 0; ei < day.exercises.length; ei++) {
      const ex = day.exercises[ei];
      await db.insert(programDayExercises).values({
        id: crypto.randomUUID(),
        dayId,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        muscleGroups: ex.muscleGroups,
        category: ex.category,
        sets: ex.sets,
        reps: ex.reps,
        weight: '0',
        weightUnit: 'lbs',
        sortOrder: ei,
      });
    }
  }

  const result = await fetchProgramWithDays(programId);
  return c.json(result, 201);
});

// POST /api/programs/:id/duplicate
router.post('/:id/duplicate', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  const newId = crypto.randomUUID();
  const now = new Date();

  await db.insert(programs).values({
    id: newId,
    userId: user.id,
    name: prog.name + ' (Copy)',
    description: prog.description ?? null,
    isActive: false,
    createdAt: now,
    updatedAt: now,
  });

  const sourceDays = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, id))
    .orderBy(asc(programDays.sortOrder));

  for (const day of sourceDays) {
    const newDayId = crypto.randomUUID();
    await db.insert(programDays).values({
      id: newDayId,
      programId: newId,
      name: day.name,
      isRest: day.isRest,
      sortOrder: day.sortOrder,
    });

    const sourceExercises = await db
      .select()
      .from(programDayExercises)
      .where(eq(programDayExercises.dayId, day.id))
      .orderBy(asc(programDayExercises.sortOrder));

    for (const ex of sourceExercises) {
      await db.insert(programDayExercises).values({
        id: crypto.randomUUID(),
        dayId: newDayId,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        muscleGroups: ex.muscleGroups,
        category: ex.category,
        sets: ex.sets,
        reps: ex.reps,
        weight: ex.weight,
        weightUnit: ex.weightUnit,
        restSeconds: ex.restSeconds ?? null,
        notes: ex.notes ?? null,
        sortOrder: ex.sortOrder,
      });
    }
  }

  const result = await fetchProgramWithDays(newId);
  return c.json(result, 201);
});

// GET /api/programs/:id
router.get('/:id', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);

  if (!prog) return c.json({ error: 'Not found' }, 404);

  const result = await fetchProgramWithDays(id);
  return c.json(result);
});

// PATCH /api/programs/:id
router.patch('/:id', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json<{
    name?: string;
    description?: string;
    isActive?: boolean;
    startDate?: string | null;
  }>();

  const updates: Partial<typeof programs.$inferInsert> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if ('startDate' in body) updates.startDate = body.startDate ?? null;

  await db.update(programs).set(updates).where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result);
});

// DELETE /api/programs/:id
router.delete('/:id', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  await db.delete(programs).where(eq(programs.id, id));
  return c.json({ ok: true });
});

// POST /api/programs/:id/activate
router.post('/:id/activate', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  // Deactivate all other programs for this user first
  await db
    .update(programs)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(programs.userId, user.id));

  await db
    .update(programs)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result);
});

// POST /api/programs/:id/days
router.post('/:id/days', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json<{ name: string; isRest?: boolean }>();
  if (!body.name?.trim()) return c.json({ error: 'Name required' }, 400);

  const existingDays = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, id));

  const dayId = crypto.randomUUID();
  await db.insert(programDays).values({
    id: dayId,
    programId: id,
    name: body.name.trim(),
    isRest: body.isRest ?? false,
    sortOrder: existingDays.length,
  });

  await db.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result, 201);
});

// PATCH /api/programs/:id/days/reorder
router.patch('/:id/days/reorder', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json<{ dayIds: string[] }>();
  if (!Array.isArray(body.dayIds)) return c.json({ error: 'dayIds required' }, 400);

  await Promise.all(
    body.dayIds.map((dayId, index) =>
      db
        .update(programDays)
        .set({ sortOrder: index })
        .where(and(eq(programDays.id, dayId), eq(programDays.programId, id))),
    ),
  );

  await db.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result);
});

// PATCH /api/programs/:id/days/:dayId
router.patch('/:id/days/:dayId', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id, dayId } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  const [day] = await db
    .select()
    .from(programDays)
    .where(and(eq(programDays.id, dayId), eq(programDays.programId, id)))
    .limit(1);
  if (!day) return c.json({ error: 'Day not found' }, 404);

  const body = await c.req.json<{ name?: string; isRest?: boolean; sortOrder?: number }>();

  const updates: Partial<typeof programDays.$inferInsert> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.isRest !== undefined) updates.isRest = body.isRest;
  if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

  await db.update(programDays).set(updates).where(eq(programDays.id, dayId));
  await db.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result);
});

// DELETE /api/programs/:id/days/:dayId
// Body: { reassignToDayId?: string }
//   omitted / undefined → schedules cascade-deleted with the day
//   provided            → schedules transferred to the new day first
router.delete('/:id/days/:dayId', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id, dayId } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  // Optional reassignment target
  let reassignToDayId: string | undefined;
  try {
    const body = await c.req.json<{ reassignToDayId?: string }>();
    reassignToDayId = body.reassignToDayId;
  } catch {
    // no body — fine
  }

  if (reassignToDayId) {
    // Verify target day belongs to this program
    const [targetDay] = await db
      .select()
      .from(programDays)
      .where(and(eq(programDays.id, reassignToDayId), eq(programDays.programId, id)))
      .limit(1);

    if (targetDay) {
      await db
        .update(daySchedules)
        .set({ dayId: reassignToDayId, dayName: targetDay.name })
        .where(eq(daySchedules.dayId, dayId));
    }
  }

  await db
    .delete(programDays)
    .where(and(eq(programDays.id, dayId), eq(programDays.programId, id)));

  await db.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result);
});

// POST /api/programs/:id/days/:dayId/exercises
router.post('/:id/days/:dayId/exercises', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id, dayId } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  const [day] = await db
    .select()
    .from(programDays)
    .where(and(eq(programDays.id, dayId), eq(programDays.programId, id)))
    .limit(1);
  if (!day) return c.json({ error: 'Day not found' }, 404);

  const body = await c.req.json<{
    exerciseId: string;
    exercise: { id: string; name: string; muscleGroups: string[]; category: string };
    sets?: number;
    reps?: number;
    weight?: number;
    weightUnit?: string;
    restSeconds?: number;
    notes?: string;
  }>();

  const existing = await db
    .select()
    .from(programDayExercises)
    .where(eq(programDayExercises.dayId, dayId));

  const exId = crypto.randomUUID();
  await db.insert(programDayExercises).values({
    id: exId,
    dayId,
    exerciseId: body.exerciseId,
    exerciseName: body.exercise.name,
    muscleGroups: body.exercise.muscleGroups,
    category: body.exercise.category,
    sets: body.sets ?? 3,
    reps: body.reps ?? 10,
    weight: String(body.weight ?? 0),
    weightUnit: body.weightUnit ?? 'lbs',
    restSeconds: body.restSeconds ?? null,
    notes: body.notes ?? null,
    sortOrder: existing.length,
  });

  await db.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result, 201);
});

// PATCH /api/programs/:id/days/:dayId/exercises/reorder
router.patch('/:id/days/:dayId/exercises/reorder', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id, dayId } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  const body = await c.req.json<{ exerciseIds: string[] }>();
  if (!Array.isArray(body.exerciseIds)) return c.json({ error: 'exerciseIds required' }, 400);

  await Promise.all(
    body.exerciseIds.map((exId, index) =>
      db
        .update(programDayExercises)
        .set({ sortOrder: index })
        .where(and(eq(programDayExercises.id, exId), eq(programDayExercises.dayId, dayId))),
    ),
  );

  await db.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result);
});

// PATCH /api/programs/:id/days/:dayId/exercises/:exId
router.patch('/:id/days/:dayId/exercises/:exId', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id, dayId, exId } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  const [ex] = await db
    .select()
    .from(programDayExercises)
    .where(and(eq(programDayExercises.id, exId), eq(programDayExercises.dayId, dayId)))
    .limit(1);
  if (!ex) return c.json({ error: 'Exercise not found' }, 404);

  const body = await c.req.json<{
    sets?: number;
    reps?: number;
    weight?: number;
    weightUnit?: string;
    restSeconds?: number | null;
    notes?: string | null;
  }>();

  const updates: Partial<typeof programDayExercises.$inferInsert> = {};
  if (body.sets !== undefined) updates.sets = body.sets;
  if (body.reps !== undefined) updates.reps = body.reps;
  if (body.weight !== undefined) updates.weight = String(body.weight);
  if (body.weightUnit !== undefined) updates.weightUnit = body.weightUnit;
  if ('restSeconds' in body) updates.restSeconds = body.restSeconds ?? null;
  if ('notes' in body) updates.notes = body.notes ?? null;

  await db.update(programDayExercises).set(updates).where(eq(programDayExercises.id, exId));
  await db.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result);
});

// DELETE /api/programs/:id/days/:dayId/exercises/:exId
router.delete('/:id/days/:dayId/exercises/:exId', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const { id, dayId, exId } = c.req.param();

  const [prog] = await db
    .select()
    .from(programs)
    .where(and(eq(programs.id, id), eq(programs.userId, user.id)))
    .limit(1);
  if (!prog) return c.json({ error: 'Not found' }, 404);

  await db
    .delete(programDayExercises)
    .where(and(eq(programDayExercises.id, exId), eq(programDayExercises.dayId, dayId)));

  await db.update(programs).set({ updatedAt: new Date() }).where(eq(programs.id, id));

  const result = await fetchProgramWithDays(id);
  return c.json(result);
});

export default router;
