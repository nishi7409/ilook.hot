import { Hono } from 'hono';
import { and, eq, desc, asc, max, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  workoutSessions,
  workoutSessionExercises,
  workoutSets,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthEnv } from '../middleware/auth.js';

const router = new Hono<AuthEnv>();

function formatSet(s: typeof workoutSets.$inferSelect) {
  return {
    id: s.id,
    setNumber: s.setNumber,
    reps: s.reps,
    weight: parseFloat(s.weight),
    weightUnit: s.weightUnit,
    completed: s.completed,
    isPersonalRecord: s.isPersonalRecord,
    completedAt: s.completedAt,
  };
}

function formatExercise(
  ex: typeof workoutSessionExercises.$inferSelect,
  sets: (typeof workoutSets.$inferSelect)[],
) {
  return {
    id: ex.id,
    exerciseId: ex.exerciseId,
    exerciseName: ex.exerciseName,
    muscleGroups: ex.muscleGroups,
    category: ex.category,
    targetSets: ex.targetSets,
    targetReps: ex.targetReps,
    notes: ex.notes,
    sortOrder: ex.sortOrder,
    exercise: {
      id: ex.exerciseId,
      name: ex.exerciseName,
      muscleGroups: ex.muscleGroups,
      category: ex.category,
      group: '',
      topRated: false,
    },
    sets: sets.map(formatSet),
  };
}

function formatSession(
  session: typeof workoutSessions.$inferSelect,
  exercises: ReturnType<typeof formatExercise>[],
) {
  return {
    id: session.id,
    date: session.date,
    name: session.name,
    programDayId: session.programDayId,
    completed: session.completed,
    durationSeconds: session.durationSeconds,
    notes: session.notes,
    createdAt: session.createdAt,
    exercises,
  };
}

async function loadSessionWithExercises(sessionId: string) {
  const session = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.id, sessionId))
    .then((r) => r[0]);

  if (!session) return null;

  const exRows = await db
    .select()
    .from(workoutSessionExercises)
    .where(eq(workoutSessionExercises.sessionId, sessionId))
    .orderBy(asc(workoutSessionExercises.sortOrder));

  const setRows = exRows.length
    ? await db
        .select()
        .from(workoutSets)
        .where(
          exRows.length === 1
            ? eq(workoutSets.sessionExerciseId, exRows[0].id)
            : // Use SQL IN via multiple queries for simplicity
              eq(workoutSets.sessionExerciseId, exRows[0].id),
        )
        .orderBy(asc(workoutSets.setNumber))
    : [];

  // Load sets for all exercises
  const setsByExercise = new Map<string, (typeof workoutSets.$inferSelect)[]>();
  for (const ex of exRows) {
    const sets = await db
      .select()
      .from(workoutSets)
      .where(eq(workoutSets.sessionExerciseId, ex.id))
      .orderBy(asc(workoutSets.setNumber));
    setsByExercise.set(ex.id, sets);
  }

  // suppress unused variable warning from earlier partial query
  void setRows;

  const formattedExercises = exRows.map((ex) =>
    formatExercise(ex, setsByExercise.get(ex.id) ?? []),
  );

  return formatSession(session, formattedExercises);
}

// GET / — completed sessions, newest first (paginated)
router.get('/', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const user = c.get('user')!;
  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10) || 20));
  const offset = (page - 1) * limit;

  const whereClause = and(
    eq(workoutSessions.userId, user.id),
    eq(workoutSessions.completed, true),
  );

  const [totalResult, sessions] = await Promise.all([
    db.select({ count: count() }).from(workoutSessions).where(whereClause).then((r) => r[0]),
    db
      .select()
      .from(workoutSessions)
      .where(whereClause)
      .orderBy(desc(workoutSessions.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult?.count ?? 0;

  const results = await Promise.all(
    sessions.map(async (s) => {
      const exRows = await db
        .select()
        .from(workoutSessionExercises)
        .where(eq(workoutSessionExercises.sessionId, s.id))
        .orderBy(asc(workoutSessionExercises.sortOrder));

      const setsByExercise = new Map<string, (typeof workoutSets.$inferSelect)[]>();
      for (const ex of exRows) {
        const sets = await db
          .select()
          .from(workoutSets)
          .where(eq(workoutSets.sessionExerciseId, ex.id))
          .orderBy(asc(workoutSets.setNumber));
        setsByExercise.set(ex.id, sets);
      }

      const formattedExercises = exRows.map((ex) =>
        formatExercise(ex, setsByExercise.get(ex.id) ?? []),
      );

      return formatSession(s, formattedExercises);
    }),
  );

  return c.json({ sessions: results, total, page, limit });
});

// GET /active — most recent incomplete session
router.get('/active', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const user = c.get('user')!;

  const session = await db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, user.id),
        eq(workoutSessions.completed, false),
      ),
    )
    .orderBy(desc(workoutSessions.createdAt))
    .limit(1)
    .then((r) => r[0]);

  if (!session) return c.json(null);

  const result = await loadSessionWithExercises(session.id);
  return c.json(result);
});

// GET /history/:exerciseId — weight history for an exercise
router.get('/history/:exerciseId', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const user = c.get('user')!;
  const exerciseId = c.req.param('exerciseId');

  // Get all completed sessions for this user
  const completedSessions = await db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, user.id),
        eq(workoutSessions.completed, true),
      ),
    );

  const sessionIds = completedSessions.map((s) => s.id);
  const sessionDateMap = new Map(completedSessions.map((s) => [s.id, s.date]));

  if (sessionIds.length === 0) return c.json([]);

  // Get all session exercises matching this exerciseId
  const history: { exerciseId: string; weight: number; reps: number; weightUnit: string; date: string }[] = [];

  for (const sessionId of sessionIds) {
    const exRows = await db
      .select()
      .from(workoutSessionExercises)
      .where(
        and(
          eq(workoutSessionExercises.sessionId, sessionId),
          eq(workoutSessionExercises.exerciseId, exerciseId),
        ),
      );

    for (const ex of exRows) {
      const sets = await db
        .select()
        .from(workoutSets)
        .where(eq(workoutSets.sessionExerciseId, ex.id));

      for (const s of sets) {
        history.push({
          exerciseId,
          weight: parseFloat(s.weight),
          reps: s.reps,
          weightUnit: s.weightUnit,
          date: sessionDateMap.get(sessionId) ?? '',
        });
      }
    }
  }

  history.sort((a, b) => a.date.localeCompare(b.date));

  return c.json(history);
});

// POST / — create new session
router.post('/', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const user = c.get('user')!;
  const body = await c.req.json<{
    date: string;
    name: string;
    programDayId?: string;
    exercises: {
      exerciseId: string;
      exerciseName: string;
      muscleGroups: string[];
      category: string;
      targetSets: number;
      targetReps: number;
    }[];
  }>();

  const sessionId = crypto.randomUUID();

  await db.insert(workoutSessions).values({
    id: sessionId,
    userId: user.id,
    date: body.date,
    name: body.name,
    programDayId: body.programDayId ?? null,
    completed: false,
  });

  if (body.exercises?.length) {
    await db.insert(workoutSessionExercises).values(
      body.exercises.map((ex, i) => ({
        id: crypto.randomUUID(),
        sessionId,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        muscleGroups: ex.muscleGroups,
        category: ex.category,
        targetSets: ex.targetSets ?? 3,
        targetReps: ex.targetReps ?? 10,
        sortOrder: i,
      })),
    );
  }

  const result = await loadSessionWithExercises(sessionId);
  return c.json(result, 201);
});

// PATCH /:id/finish — mark session completed
router.patch('/:id/finish', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const user = c.get('user')!;
  const id = c.req.param('id');
  const body = await c.req.json<{ durationSeconds?: number }>().catch(() => ({} as { durationSeconds?: number }));

  const existing = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, user.id)))
    .then((r) => r[0]);

  if (!existing) return c.json({ error: 'Session not found' }, 404);

  await db
    .update(workoutSessions)
    .set({
      completed: true,
      ...(body.durationSeconds != null ? { durationSeconds: body.durationSeconds } : {}),
    })
    .where(eq(workoutSessions.id, id));

  const result = await loadSessionWithExercises(id);
  return c.json(result);
});

// DELETE /:id — discard session
router.delete('/:id', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const user = c.get('user')!;
  const id = c.req.param('id');

  const existing = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, id), eq(workoutSessions.userId, user.id)))
    .then((r) => r[0]);

  if (!existing) return c.json({ error: 'Session not found' }, 404);

  await db.delete(workoutSessions).where(eq(workoutSessions.id, id));

  return c.json({ success: true });
});

// POST /:sessionId/exercises/:sessionExerciseId/sets — log a set
router.post('/:sessionId/exercises/:sessionExerciseId/sets', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const user = c.get('user')!;
  const sessionId = c.req.param('sessionId');
  const sessionExerciseId = c.req.param('sessionExerciseId');

  const body = await c.req.json<{
    reps: number;
    weight: number;
    weightUnit: string;
  }>();

  // Verify session belongs to user
  const session = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.id, sessionId), eq(workoutSessions.userId, user.id)))
    .then((r) => r[0]);

  if (!session) return c.json({ error: 'Session not found' }, 404);

  // Verify session exercise belongs to this session
  const sessionExercise = await db
    .select()
    .from(workoutSessionExercises)
    .where(
      and(
        eq(workoutSessionExercises.id, sessionExerciseId),
        eq(workoutSessionExercises.sessionId, sessionId),
      ),
    )
    .then((r) => r[0]);

  if (!sessionExercise) return c.json({ error: 'Exercise not found in session' }, 404);

  // Detect PR: single JOIN query to find max previous weight for this exercise
  const prResult = await db
    .select({ maxWeight: max(workoutSets.weight) })
    .from(workoutSets)
    .innerJoin(workoutSessionExercises, eq(workoutSets.sessionExerciseId, workoutSessionExercises.id))
    .innerJoin(workoutSessions, eq(workoutSessionExercises.sessionId, workoutSessions.id))
    .where(
      and(
        eq(workoutSessions.userId, user.id),
        eq(workoutSessions.completed, true),
        eq(workoutSessionExercises.exerciseId, sessionExercise.exerciseId),
      ),
    )
    .then((r) => r[0]);

  const maxPreviousWeight = prResult?.maxWeight ? parseFloat(prResult.maxWeight) : 0;
  const isPersonalRecord = body.weight > maxPreviousWeight && maxPreviousWeight > 0;

  // Determine set number
  const existingSets = await db
    .select()
    .from(workoutSets)
    .where(eq(workoutSets.sessionExerciseId, sessionExerciseId));

  const setNumber = existingSets.length + 1;
  const setId = crypto.randomUUID();

  await db.insert(workoutSets).values({
    id: setId,
    sessionExerciseId,
    setNumber,
    reps: body.reps,
    weight: String(body.weight),
    weightUnit: body.weightUnit ?? 'lbs',
    completed: true,
    isPersonalRecord,
    completedAt: new Date().toISOString(),
  });

  const newSet = await db
    .select()
    .from(workoutSets)
    .where(eq(workoutSets.id, setId))
    .then((r) => r[0]);

  return c.json({ ...formatSet(newSet), isPersonalRecord }, 201);
});

// GET /analytics — comprehensive dashboard analytics
router.get('/analytics', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const user = c.get('user')!;
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const today = fmt(now);
  const twelveWeeksAgo = new Date(now);
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
  const oneYearAgo = new Date(now);
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setDate(oneMonthAgo.getDate() - 30);

  const allSessions = await db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.userId, user.id), eq(workoutSessions.completed, true)))
    .orderBy(desc(workoutSessions.date));

  const recentSessionIds = allSessions.filter((s) => s.date >= fmt(twelveWeeksAgo)).map((s) => s.id);

  const allExercises: (typeof workoutSessionExercises.$inferSelect)[] = [];
  const allSetsByExId = new Map<string, (typeof workoutSets.$inferSelect)[]>();

  for (const sessionId of recentSessionIds) {
    const exRows = await db.select().from(workoutSessionExercises).where(eq(workoutSessionExercises.sessionId, sessionId));
    for (const ex of exRows) {
      allExercises.push(ex);
      const sets = await db.select().from(workoutSets).where(eq(workoutSets.sessionExerciseId, ex.id));
      allSetsByExId.set(ex.id, sets);
    }
  }

  const sessionDateMap = new Map(allSessions.map((s) => [s.id, s.date]));

  // a) Estimated 1RM (Epley formula)
  const exerciseMap = new Map<string, { exerciseId: string; exerciseName: string; muscleGroups: string[]; current1RM: number; prev1RM: number; weightUnit: string }>();

  for (const ex of allExercises) {
    const sets = allSetsByExId.get(ex.id) ?? [];
    const sessionDate = sessionDateMap.get(ex.sessionId) ?? '';
    for (const s of sets) {
      if (!s.completed) continue;
      const weight = parseFloat(s.weight);
      const reps = s.reps;
      if (weight <= 0 || reps <= 0) continue;
      const e1rm = reps === 1 ? weight : weight * (1 + reps / 30);
      const existing = exerciseMap.get(ex.exerciseId);
      const isRecent = sessionDate >= fmt(oneMonthAgo);
      if (!existing) {
        exerciseMap.set(ex.exerciseId, { exerciseId: ex.exerciseId, exerciseName: ex.exerciseName, muscleGroups: ex.muscleGroups, current1RM: isRecent ? e1rm : 0, prev1RM: !isRecent ? e1rm : 0, weightUnit: s.weightUnit });
      } else {
        if (isRecent && e1rm > existing.current1RM) existing.current1RM = e1rm;
        if (!isRecent && e1rm > existing.prev1RM) existing.prev1RM = e1rm;
      }
    }
  }

  const estimated1RMs = Array.from(exerciseMap.values())
    .filter((e) => e.current1RM > 0)
    .map((e) => ({
      exerciseId: e.exerciseId, exerciseName: e.exerciseName, muscleGroups: e.muscleGroups,
      estimated1RM: Math.round(e.current1RM * 10) / 10,
      trend: e.prev1RM > 0 ? (e.current1RM > e.prev1RM * 1.01 ? 'up' : e.current1RM < e.prev1RM * 0.99 ? 'down' : 'same') : 'same',
      weightUnit: e.weightUnit,
    }))
    .sort((a, b) => b.estimated1RM - a.estimated1RM);

  // b) Volume per muscle group (12 weeks, weekly buckets)
  const weekBuckets: { weekStart: string; weekLabel: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const monday = new Date(d);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    weekBuckets.push({ weekStart: fmt(monday), weekLabel: `W${12 - i}` });
  }

  const volumeByMuscleGroup = new Map<string, number[]>();
  for (const ex of allExercises) {
    const sets = allSetsByExId.get(ex.id) ?? [];
    const sessionDate = sessionDateMap.get(ex.sessionId) ?? '';
    if (sessionDate < fmt(twelveWeeksAgo)) continue;
    const weekIdx = weekBuckets.findIndex((wb, i) => {
      const nextStart = i < weekBuckets.length - 1 ? weekBuckets[i + 1].weekStart : '9999-99-99';
      return sessionDate >= wb.weekStart && sessionDate < nextStart;
    });
    if (weekIdx === -1) continue;
    for (const mg of ex.muscleGroups) {
      if (!volumeByMuscleGroup.has(mg)) volumeByMuscleGroup.set(mg, new Array(12).fill(0));
      const arr = volumeByMuscleGroup.get(mg)!;
      for (const s of sets) {
        if (!s.completed) continue;
        arr[weekIdx] += s.reps * parseFloat(s.weight);
      }
    }
  }

  const volumeData = {
    weeks: weekBuckets.map((w) => w.weekLabel),
    muscleGroups: Array.from(volumeByMuscleGroup.entries()).map(([name, data]) => ({ name, data: data.map((v) => Math.round(v)) })),
  };

  // c) Training frequency heatmap (365 days)
  const sessionCountByDate = new Map<string, number>();
  for (const s of allSessions) {
    if (s.date >= fmt(oneYearAgo)) sessionCountByDate.set(s.date, (sessionCountByDate.get(s.date) ?? 0) + 1);
  }
  const heatmapData: { date: string; count: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = fmt(d);
    heatmapData.push({ date: key, count: sessionCountByDate.get(key) ?? 0 });
  }

  // d) Weekly consistency
  const weeklySessionCounts: { week: string; count: number }[] = [];
  for (let wi = 0; wi < weekBuckets.length; wi++) {
    const wb = weekBuckets[wi];
    const nextStart = wi < weekBuckets.length - 1 ? weekBuckets[wi + 1].weekStart : '9999-99-99';
    const cnt = allSessions.filter((s) => s.date >= wb.weekStart && s.date < nextStart).length;
    weeklySessionCounts.push({ week: wb.weekLabel, count: cnt });
  }

  let currentStreak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (sessionCountByDate.has(fmt(d))) { currentStreak++; } else if (i > 0) { break; }
  }

  let longestStreak = 0;
  let tempStreak = 0;
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (sessionCountByDate.has(fmt(d))) { tempStreak++; longestStreak = Math.max(longestStreak, tempStreak); } else { tempStreak = 0; }
  }

  const monday = new Date(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const thisWeekSessions = allSessions.filter((s) => s.date >= fmt(monday) && s.date <= today).length;

  return c.json({ estimated1RMs, volumeData, heatmapData, consistency: { weeklySessionCounts, currentStreak, longestStreak, thisWeekSessions } });
});

export default router;
