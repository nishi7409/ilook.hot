export type WeightUnit = 'lbs' | 'kg';

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: string[];
  category: 'compound' | 'isolation' | 'cardio' | 'bodyweight';
  group: string;
  topRated?: boolean;
  demoUrl?: string | null;
}

export interface ProgramExercise {
  /** DB row UUID — present when loaded from API, absent for optimistic inserts */
  rowId?: string;
  exerciseId: string;
  exercise: Exercise;
  sets: number;
  reps: number;
  weight: number;
  weightUnit: WeightUnit;
  restSeconds?: number;
  notes?: string;
}

export interface ProgramDay {
  id: string;
  name: string; // e.g. "Push", "Pull", "Legs"
  isRest: boolean;
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  days: ProgramDay[];
  isActive: boolean;
  startDate?: string; // ISO date string
  createdAt: string;
  updatedAt: string;
}

export interface CalendarWorkoutEvent {
  date: Date;
  dayIndex: number;
  day: ProgramDay;
  programId: string;
  programName: string;
  isActive: boolean;
}

export interface ExerciseScheduleEntry {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  programId: string;
  startDate: string; // yyyy-MM-dd
  frequencyCount: number;
  frequencyUnit: 'day' | 'week' | 'month';
}

export interface PendingExerciseSchedule {
  startDate: Date;
  frequencyCount: number;
  frequencyUnit: 'day' | 'week' | 'month';
}

export interface DayScheduleEntry {
  id: string;
  programId: string;
  dayId: string;
  dayName: string;
  startDate: string; // yyyy-MM-dd
  frequencyCount: number;
  frequencyUnit: 'day' | 'week' | 'month';
  /** yyyy-MM-dd — recurrence stops before this date (used for "delete from here") */
  endDate?: string;
  /** yyyy-MM-dd strings — individual dates excluded from recurrence */
  excludedDates?: string[];
}

export interface DayScheduleCalendarEvent {
  date: Date;
  title: string;
  programId: string;
  dayId: string;
  scheduleId: string;
}

export interface TemplateInfo {
  key: string;
  name: string;
  description: string;
  split: string;
  daysPerWeek: number;
  days: { name: string; isRest: boolean; exerciseCount: number }[];
  volumeSummary: { group: string; sets: number; pct: number }[];
}
