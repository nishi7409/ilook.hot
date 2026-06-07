// This file is kept for backwards compatibility.
// Exercise data is now served from the API and loaded via ExerciseService.
import type { Exercise } from '../models/program.model';

export const EXERCISE_LIBRARY: Exercise[] = [];

export const EXERCISE_GROUPS: { name: string; exercises: Exercise[] }[] = [];
