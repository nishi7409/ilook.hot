import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  programs,
  programDays,
  programDayExercises,
  daySchedules,
  workoutSessions,
  workoutSessionExercises,
  workoutSets,
  nutritionLogs,
  nutritionGoals,
  progressPhotos,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthEnv } from '../middleware/auth.js';

const router = new Hono<AuthEnv>();

// GET / — full data export for the authenticated user
router.get('/', async (c) => {
  const authError = requireAuth(c);
  if (authError) return authError;
  const user = c.get('user')!;

  // Fetch user email
  const userRow = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, user.id))
    .then((rows) => rows[0]);

  // Programs with days, exercises, schedules
  const userPrograms = await db.select().from(programs).where(eq(programs.userId, user.id));

  const programsExport = [];
  for (const prog of userPrograms) {
    const days = await db.select().from(programDays).where(eq(programDays.programId, prog.id));

    const daysWithExercises = [];
    for (const day of days) {
      const exercises = await db
        .select()
        .from(programDayExercises)
        .where(eq(programDayExercises.dayId, day.id));
      daysWithExercises.push({ ...day, exercises });
    }

    const schedules = await db
      .select()
      .from(daySchedules)
      .where(eq(daySchedules.programId, prog.id));

    programsExport.push({ ...prog, days: daysWithExercises, schedules });
  }

  // Workout sessions with exercises and sets
  const userSessions = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.userId, user.id));

  const workoutsExport = [];
  for (const session of userSessions) {
    const exercises = await db
      .select()
      .from(workoutSessionExercises)
      .where(eq(workoutSessionExercises.sessionId, session.id));

    const exercisesWithSets = [];
    for (const ex of exercises) {
      const sets = await db
        .select()
        .from(workoutSets)
        .where(eq(workoutSets.sessionExerciseId, ex.id));
      exercisesWithSets.push({ ...ex, sets });
    }

    workoutsExport.push({ ...session, exercises: exercisesWithSets });
  }

  // Nutrition
  const logs = await db
    .select()
    .from(nutritionLogs)
    .where(eq(nutritionLogs.userId, user.id));

  const goals = await db
    .select()
    .from(nutritionGoals)
    .where(eq(nutritionGoals.userId, user.id))
    .then((rows) => rows[0] ?? null);

  // Progress photos (metadata only — no file URLs)
  const photos = await db
    .select({
      id: progressPhotos.id,
      date: progressPhotos.date,
      category: progressPhotos.category,
      bodyweight: progressPhotos.bodyweight,
      notes: progressPhotos.notes,
      createdAt: progressPhotos.createdAt,
    })
    .from(progressPhotos)
    .where(eq(progressPhotos.userId, user.id));

  return c.json({
    exportedAt: new Date().toISOString(),
    user: { email: userRow?.email ?? '' },
    programs: programsExport,
    workouts: workoutsExport,
    nutrition: { logs, goals },
    photos,
  });
});

export default router;
