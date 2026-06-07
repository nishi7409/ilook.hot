import type { Exercise, WeightUnit } from './program.model';

export interface WorkoutSet {
  id: string;
  setNumber: number;
  reps: number;
  weight: number;
  weightUnit: WeightUnit;
  completed: boolean;
  isPersonalRecord: boolean;
  completedAt?: string;
}

export interface SessionExercise {
  id: string;
  exercise: Exercise;
  targetSets: number;
  targetReps: number;
  sets: WorkoutSet[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  date: string; // ISO date string
  name: string;
  programDayId?: string;
  exercises: SessionExercise[];
  durationSeconds?: number;
  notes?: string;
  completed: boolean;
}

export interface ExerciseRecord {
  exerciseId: string;
  weight: number;
  weightUnit: WeightUnit;
  reps: number;
  date: string;
}
