import { pgTable, text, boolean, integer, timestamp, numeric } from 'drizzle-orm/pg-core';

// Users (Lucia requires id: text primary key)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  calendarHash: text('calendar_hash').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sessions (Lucia requires: id, userId, expiresAt with timezone+date mode)
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
});

// Programs
export const programs = pgTable('programs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isActive: boolean('is_active').default(false).notNull(),
  startDate: text('start_date'), // yyyy-MM-dd, nullable
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Program days
export const programDays = pgTable('program_days', {
  id: text('id').primaryKey(),
  programId: text('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isRest: boolean('is_rest').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
});

// Program day exercises (denormalized: store exercise name/groups/category inline)
export const programDayExercises = pgTable('program_day_exercises', {
  id: text('id').primaryKey(),
  dayId: text('day_id').notNull().references(() => programDays.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id').notNull(),
  exerciseName: text('exercise_name').notNull(),
  muscleGroups: text('muscle_groups').array().notNull().default([]),
  category: text('category').notNull(),
  sets: integer('sets').default(3).notNull(),
  reps: text('reps').default('8-12').notNull(),
  weight: numeric('weight', { precision: 8, scale: 2 }).default('0').notNull(),
  weightUnit: text('weight_unit').default('lbs').notNull(),
  restSeconds: integer('rest_seconds'),
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0).notNull(),
});

// Day schedules (recurrence entries)
export const daySchedules = pgTable('day_schedules', {
  id: text('id').primaryKey(),
  programId: text('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  dayId: text('day_id').notNull().references(() => programDays.id, { onDelete: 'cascade' }),
  dayName: text('day_name').notNull(),
  startDate: text('start_date').notNull(), // yyyy-MM-dd
  frequencyCount: integer('frequency_count').default(1).notNull(),
  frequencyUnit: text('frequency_unit').default('week').notNull(), // day | week | month
  endDate: text('end_date'), // yyyy-MM-dd, nullable
  excludedDates: text('excluded_dates').array().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
