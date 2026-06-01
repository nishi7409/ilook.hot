import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, daySchedules, programs } from '../db/schema.js';
import { addDays, addMonths, differenceInDays, format, startOfDay } from 'date-fns';

const app = new Hono();

function icsDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

app.get('/user/:hash', async (c) => {
  const hash = c.req.param('hash');

  const user = await db.query.users.findFirst({
    where: eq(users.calendarHash, hash),
  });

  if (!user) {
    return c.text('Not found', 404);
  }

  // Get all program IDs for this user
  const userPrograms = await db
    .select({ id: programs.id })
    .from(programs)
    .where(eq(programs.userId, user.id));

  if (userPrograms.length === 0) {
    return c.text(
      ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ilook.hot//Workout Calendar//EN', 'END:VCALENDAR'].join('\r\n'),
      200,
      { 'Content-Type': 'text/calendar; charset=utf-8' },
    );
  }

  const programIds = userPrograms.map((p) => p.id);
  const schedules = await db
    .select()
    .from(daySchedules)
    .where(inArray(daySchedules.programId, programIds));

  const today = startOfDay(new Date());
  const windowStart = addDays(today, -30);
  const windowEnd = addDays(today, 180);

  const events: Array<{ date: string; title: string; uid: string }> = [];

  for (const sched of schedules) {
    const excluded = new Set(sched.excludedDates ?? []);
    const end = sched.endDate ? startOfDay(new Date(sched.endDate)) : null;
    let cursor = startOfDay(new Date(sched.startDate));

    while (cursor <= windowEnd) {
      if (end && cursor >= end) break;
      const iso = format(cursor, 'yyyy-MM-dd');
      if (cursor >= windowStart && !excluded.has(iso)) {
        events.push({
          date: iso,
          title: sched.dayName,
          uid: `${sched.id}-${iso}@ilook.hot`,
        });
      }
      if (sched.frequencyUnit === 'day') cursor = addDays(cursor, sched.frequencyCount);
      else if (sched.frequencyUnit === 'week') cursor = addDays(cursor, sched.frequencyCount * 7);
      else cursor = addMonths(cursor, sched.frequencyCount);
      if (differenceInDays(cursor, today) > 400) break;
    }
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ilook.hot//Workout Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(user.email)} workouts`,
    'X-WR-TIMEZONE:UTC',
  ];

  for (const ev of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTART;VALUE=DATE:${icsDate(ev.date)}`,
      `DTEND;VALUE=DATE:${icsDate(ev.date)}`,
      `SUMMARY:${icsEscape(ev.title)}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');

  return c.text(lines.join('\r\n'), 200, {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="workouts.ics"',
    'Cache-Control': 'no-cache',
  });
});

export default app;
