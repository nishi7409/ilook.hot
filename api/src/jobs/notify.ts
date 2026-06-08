import { eq, and, isNull } from 'drizzle-orm';
import webpush from 'web-push';
import { db } from '../db/index.js';
import { pushSubscriptions, daySchedules, programs, programDays } from '../db/schema.js';

/**
 * Check today's scheduled workouts and send push notifications.
 * Returns the number of notifications sent.
 */
export async function sendWorkoutReminders(): Promise<{ sent: number; errors: number }> {
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('VAPID keys not configured, skipping push notifications');
    return { sent: 0, errors: 0 };
  }

  const today = new Date().toISOString().slice(0, 10); // yyyy-MM-dd

  // Get all active schedules
  const schedules = await db
    .select({
      scheduleId: daySchedules.id,
      programId: daySchedules.programId,
      dayId: daySchedules.dayId,
      dayName: daySchedules.dayName,
      startDate: daySchedules.startDate,
      frequencyCount: daySchedules.frequencyCount,
      frequencyUnit: daySchedules.frequencyUnit,
      endDate: daySchedules.endDate,
      excludedDates: daySchedules.excludedDates,
      userId: programs.userId,
      programName: programs.name,
    })
    .from(daySchedules)
    .innerJoin(programs, eq(daySchedules.programId, programs.id))
    .where(eq(programs.isActive, true));

  // Figure out which users have a workout today
  const userWorkouts = new Map<string, string[]>(); // userId -> workout names

  for (const sched of schedules) {
    if (sched.endDate && sched.endDate < today) continue;
    if (sched.startDate > today) continue;
    if (sched.excludedDates?.includes(today)) continue;

    // Check if today matches the recurrence
    if (isScheduledForDate(sched.startDate, today, sched.frequencyCount, sched.frequencyUnit)) {
      const names = userWorkouts.get(sched.userId) ?? [];
      names.push(sched.dayName);
      userWorkouts.set(sched.userId, names);
    }
  }

  let sent = 0;
  let errors = 0;

  for (const [userId, workoutNames] of userWorkouts) {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    if (subs.length === 0) continue;

    const nameList = workoutNames.join(', ');
    const payload = JSON.stringify({
      title: '🏋️ Workout Today',
      body: `Scheduled: ${nameList}`,
      url: '/workouts',
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent++;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
        }
        errors++;
        console.error('Push notification error:', err);
      }
    }
  }

  return { sent, errors };
}

function isScheduledForDate(
  startDate: string,
  targetDate: string,
  frequencyCount: number,
  frequencyUnit: string,
): boolean {
  const start = new Date(startDate + 'T00:00:00Z');
  const target = new Date(targetDate + 'T00:00:00Z');
  const diffMs = target.getTime() - start.getTime();

  if (diffMs < 0) return false;

  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  switch (frequencyUnit) {
    case 'day':
      return diffDays % frequencyCount === 0;
    case 'week':
      return diffDays % (frequencyCount * 7) === 0;
    case 'month': {
      const startD = start.getUTCDate();
      const targetD = target.getUTCDate();
      if (startD !== targetD) return false;
      const monthsDiff =
        (target.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        (target.getUTCMonth() - start.getUTCMonth());
      return monthsDiff >= 0 && monthsDiff % frequencyCount === 0;
    }
    default:
      return false;
  }
}
