import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './db/index.js';
import authRoutes from './routes/auth.js';
import programRoutes from './routes/programs.js';
import scheduleRoutes from './routes/schedules.js';
import calendarRoutes from './routes/calendar.js';
import exerciseRoutes from './routes/exercises.js';
import workoutRoutes from './routes/workouts.js';
import nutritionRoutes from './routes/nutrition.js';
import { seedExercises } from './data/exercises.js';
import { authMiddleware } from './middleware/auth.js';
import type { AuthEnv } from './middleware/auth.js';

const app = new Hono<AuthEnv>();

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin ?? '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Cookie'],
  exposeHeaders: ['Set-Cookie'],
}));
app.use('*', authMiddleware);

app.route('/api/auth', authRoutes);
app.route('/api/programs', programRoutes);
app.route('/api/schedules', scheduleRoutes);
app.route('/api/exercises', exerciseRoutes);
app.route('/calendar', calendarRoutes);
app.route('/api/workouts', workoutRoutes);
app.route('/api/nutrition', nutritionRoutes);

app.get('/api/health', (c) => c.json({ ok: true }));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

const port = parseInt(process.env.PORT ?? '3000', 10);

console.log('Running database migrations...');
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations complete.');

await seedExercises(db);

console.log(`API listening on port ${port}`);
serve({ fetch: app.fetch, port });
