import { Hono } from 'hono';
import { and, eq, desc, asc, max } from 'drizzle-orm';
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

// GET / — all completed sessions, newest first
router.get('/', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;

  const user = c.get('user')!;

  const sessions = await db
    .select()
    .from(workoutSessions)
    .where(
      and(
        eq(workoutSessions.userId, user.id),
        eq(workoutSessions.completed, true),
      ),
    )
    .orderBy(desc(workoutSessions.createdAt));

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

  return c.json(results);
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
  const body = await c.req.json<{ durationSeconds?: number }>().catch(() => ({}));

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

export default router;
