import { Hono } from 'hono';
import { eq, and, sql, desc, gte, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  progressPhotos,
  workoutSessions,
  workoutSessionExercises,
  workoutSets,
  programs,
  programDays,
  programDayExercises,
  nutritionLogs,
} from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import type { AuthEnv } from '../middleware/auth.js';

const router = new Hono<AuthEnv>();

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && !slug.includes('--');
}

// GET /api/profile/settings — get current user's profile settings
router.get('/settings', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  const [row] = await db
    .select({
      publicProfileEnabled: users.publicProfileEnabled,
      profileSlug: users.profileSlug,
      profileDisplayName: users.profileDisplayName,
      profileShowStats: users.profileShowStats,
      profileShowPhotos: users.profileShowPhotos,
      profileShowProgram: users.profileShowProgram,
      profileShowNutrition: users.profileShowNutrition,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row) return c.json({ error: 'User not found' }, 404);
  return c.json(row);
});

// PATCH /api/profile/settings — update profile settings
router.patch('/settings', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;

  const body = await c.req.json<{
    publicProfileEnabled?: boolean;
    profileSlug?: string | null;
    profileDisplayName?: string | null;
    profileShowStats?: boolean;
    profileShowPhotos?: boolean;
    profileShowProgram?: boolean;
    profileShowNutrition?: boolean;
  }>();

  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };

  if (body.publicProfileEnabled !== undefined) updates.publicProfileEnabled = body.publicProfileEnabled;
  if (body.profileShowStats !== undefined) updates.profileShowStats = body.profileShowStats;
  if (body.profileShowPhotos !== undefined) updates.profileShowPhotos = body.profileShowPhotos;
  if (body.profileShowProgram !== undefined) updates.profileShowProgram = body.profileShowProgram;
  if (body.profileShowNutrition !== undefined) updates.profileShowNutrition = body.profileShowNutrition;

  if (body.profileDisplayName !== undefined) {
    updates.profileDisplayName = body.profileDisplayName?.trim() || null;
  }

  if (body.profileSlug !== undefined) {
    if (body.profileSlug === null || body.profileSlug === '') {
      updates.profileSlug = null;
    } else {
      const slug = body.profileSlug.toLowerCase().trim();
      if (!isValidSlug(slug)) {
        return c.json({ error: 'Invalid slug. Use 3-30 lowercase alphanumeric characters and hyphens.' }, 400);
      }
      // Check uniqueness
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.profileSlug, slug))
        .limit(1);
      if (existing.length && existing[0].id !== user.id) {
        return c.json({ error: 'Slug already taken' }, 409);
      }
      updates.profileSlug = slug;
    }
  }

  await db.update(users).set(updates).where(eq(users.id, user.id));

  // Return updated settings
  const [row] = await db
    .select({
      publicProfileEnabled: users.publicProfileEnabled,
      profileSlug: users.profileSlug,
      profileDisplayName: users.profileDisplayName,
      profileShowStats: users.profileShowStats,
      profileShowPhotos: users.profileShowPhotos,
      profileShowProgram: users.profileShowProgram,
      profileShowNutrition: users.profileShowNutrition,
    })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  return c.json(row);
});

// GET /api/profile/check-slug/:slug — check if slug is available
router.get('/check-slug/:slug', async (c) => {
  const guard = requireAuth(c);
  if (guard) return guard;
  const user = c.get('user')!;
  const slug = c.req.param('slug').toLowerCase().trim();

  if (!isValidSlug(slug)) {
    return c.json({ available: false, reason: 'Invalid format' });
  }

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.profileSlug, slug))
    .limit(1);

  const available = existing.length === 0 || existing[0].id === user.id;
  return c.json({ available });
});

// GET /api/u/:slug — PUBLIC endpoint, no auth required
router.get('/u/:slug', async (c) => {
  const slug = c.req.param('slug').toLowerCase().trim();

  const [profile] = await db
    .select()
    .from(users)
    .where(and(eq(users.profileSlug, slug), eq(users.publicProfileEnabled, true)))
    .limit(1);

  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }

  const result: Record<string, unknown> = {
    displayName: profile.profileDisplayName || profile.profileSlug,
    memberSince: profile.createdAt.toISOString(),
    showStats: profile.profileShowStats,
    showPhotos: profile.profileShowPhotos,
    showProgram: profile.profileShowProgram,
    showNutrition: profile.profileShowNutrition,
  };

  // Stats
  if (profile.profileShowStats) {
    // Total completed workouts
    const [workoutCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.userId, profile.id), eq(workoutSessions.completed, true)));

    // Current streak
    const recentSessions = await db
      .select({ date: workoutSessions.date })
      .from(workoutSessions)
      .where(and(eq(workoutSessions.userId, profile.id), eq(workoutSessions.completed, true)))
      .orderBy(desc(workoutSessions.date));

    let streak = 0;
    if (recentSessions.length > 0) {
      const uniqueDates = [...new Set(recentSessions.map((s) => s.date))].sort().reverse();
      const today = new Date().toISOString().slice(0, 10);
      // Start from today or the most recent workout date
      let checkDate = today;
      if (uniqueDates[0] !== today) {
        // Check if yesterday matches
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (uniqueDates[0] === yesterday) {
          checkDate = yesterday;
        } else {
          checkDate = uniqueDates[0];
        }
      }

      for (const d of uniqueDates) {
        if (d === checkDate) {
          streak++;
          const prev = new Date(checkDate);
          prev.setDate(prev.getDate() - 1);
          checkDate = prev.toISOString().slice(0, 10);
        } else if (d < checkDate) {
          break;
        }
      }
    }

    // PRs — best estimated 1RM per exercise
    const allSets = await db
      .select({
        exerciseName: workoutSessionExercises.exerciseName,
        reps: workoutSets.reps,
        weight: workoutSets.weight,
      })
      .from(workoutSets)
      .innerJoin(workoutSessionExercises, eq(workoutSets.sessionExerciseId, workoutSessionExercises.id))
      .innerJoin(workoutSessions, eq(workoutSessionExercises.sessionId, workoutSessions.id))
      .where(eq(workoutSessions.userId, profile.id));

    const prMap = new Map<string, number>();
    for (const s of allSets) {
      const w = parseFloat(s.weight);
      if (w <= 0 || s.reps <= 0) continue;
      // Epley formula for 1RM
      const oneRM = s.reps === 1 ? w : w * (1 + s.reps / 30);
      const current = prMap.get(s.exerciseName) ?? 0;
      if (oneRM > current) prMap.set(s.exerciseName, oneRM);
    }

    const prs = Array.from(prMap.entries())
      .map(([exercise, estimated1RM]) => ({ exercise, estimated1RM: Math.round(estimated1RM) }))
      .sort((a, b) => b.estimated1RM - a.estimated1RM)
      .slice(0, 10);

    result.stats = {
      totalWorkouts: Number(workoutCount.count),
      currentStreak: streak,
      prs,
    };
  }

  // Photos
  if (profile.profileShowPhotos) {
    const photos = await db
      .select({
        id: progressPhotos.id,
        date: progressPhotos.date,
        photoUrl: progressPhotos.photoUrl,
        category: progressPhotos.category,
      })
      .from(progressPhotos)
      .where(and(eq(progressPhotos.userId, profile.id), eq(progressPhotos.isPublic, true)))
      .orderBy(desc(progressPhotos.date))
      .limit(20);

    result.photos = photos;
  }

  // Program
  if (profile.profileShowProgram) {
    const [activeProgram] = await db
      .select()
      .from(programs)
      .where(and(eq(programs.userId, profile.id), eq(programs.isActive, true)))
      .limit(1);

    if (activeProgram) {
      const days = await db
        .select()
        .from(programDays)
        .where(eq(programDays.programId, activeProgram.id))
        .orderBy(asc(programDays.sortOrder));

      const dayData = await Promise.all(
        days.map(async (day) => {
          const [exerciseCount] = await db
            .select({ count: sql<number>`count(*)` })
            .from(programDayExercises)
            .where(eq(programDayExercises.dayId, day.id));
          return {
            name: day.name,
            isRest: day.isRest,
            exerciseCount: Number(exerciseCount.count),
          };
        }),
      );

      result.program = {
        name: activeProgram.name,
        days: dayData,
      };
    }
  }

  // Nutrition
  if (profile.profileShowNutrition) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const avgRows = await db
      .select({
        avgCalories: sql<number>`coalesce(avg(daily_cals), 0)`,
        avgProtein: sql<number>`coalesce(avg(daily_protein), 0)`,
        avgCarbs: sql<number>`coalesce(avg(daily_carbs), 0)`,
        avgFat: sql<number>`coalesce(avg(daily_fat), 0)`,
      })
      .from(
        db
          .select({
            daily_cals: sql<number>`sum(cast(${nutritionLogs.calories} as numeric) * cast(${nutritionLogs.servings} as numeric))`.as('daily_cals'),
            daily_protein: sql<number>`sum(cast(${nutritionLogs.protein} as numeric) * cast(${nutritionLogs.servings} as numeric))`.as('daily_protein'),
            daily_carbs: sql<number>`sum(cast(${nutritionLogs.carbs} as numeric) * cast(${nutritionLogs.servings} as numeric))`.as('daily_carbs'),
            daily_fat: sql<number>`sum(cast(${nutritionLogs.fat} as numeric) * cast(${nutritionLogs.servings} as numeric))`.as('daily_fat'),
          })
          .from(nutritionLogs)
          .where(and(eq(nutritionLogs.userId, profile.id), gte(nutritionLogs.date, sevenDaysAgo)))
          .groupBy(nutritionLogs.date)
          .as('daily'),
      );

    result.nutrition = {
      avgCalories: Math.round(Number(avgRows[0]?.avgCalories ?? 0)),
      avgProtein: Math.round(Number(avgRows[0]?.avgProtein ?? 0)),
      avgCarbs: Math.round(Number(avgRows[0]?.avgCarbs ?? 0)),
      avgFat: Math.round(Number(avgRows[0]?.avgFat ?? 0)),
    };
  }

  return c.json(result);
});

export default router;
