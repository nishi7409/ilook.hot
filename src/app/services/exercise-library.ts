import type { Exercise } from '../models/program.model';

export const EXERCISE_LIBRARY: Exercise[] = [
  // Compound legs
  { id: 'squat', name: 'Squat', muscleGroups: ['Quads', 'Glutes', 'Hamstrings'], category: 'compound' },
  { id: 'rdl', name: 'Romanian Deadlift', muscleGroups: ['Hamstrings', 'Glutes', 'Lower Back'], category: 'compound' },
  { id: 'leg-press', name: 'Leg Press', muscleGroups: ['Quads', 'Glutes'], category: 'compound' },
  { id: 'lunges', name: 'Walking Lunges', muscleGroups: ['Quads', 'Glutes', 'Hamstrings'], category: 'compound' },
  { id: 'calf-raises', name: 'Calf Raises', muscleGroups: ['Calves'], category: 'isolation' },
  { id: 'leg-curl', name: 'Leg Curl', muscleGroups: ['Hamstrings'], category: 'isolation' },
  // Compound back
  { id: 'deadlift', name: 'Deadlift', muscleGroups: ['Lower Back', 'Glutes', 'Hamstrings', 'Traps'], category: 'compound' },
  { id: 'bent-row', name: 'Bent-over Row', muscleGroups: ['Lats', 'Rhomboids', 'Biceps'], category: 'compound' },
  { id: 'pullup', name: 'Pull-ups', muscleGroups: ['Lats', 'Biceps'], category: 'bodyweight' },
  { id: 'cable-row', name: 'Cable Row', muscleGroups: ['Lats', 'Rhomboids'], category: 'compound' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscleGroups: ['Lats', 'Biceps'], category: 'compound' },
  // Chest
  { id: 'bench', name: 'Bench Press', muscleGroups: ['Chest', 'Triceps', 'Shoulders'], category: 'compound' },
  { id: 'incline-db', name: 'Incline Dumbbell Press', muscleGroups: ['Upper Chest', 'Triceps'], category: 'compound' },
  { id: 'cable-fly', name: 'Cable Fly', muscleGroups: ['Chest'], category: 'isolation' },
  { id: 'pushup', name: 'Push-ups', muscleGroups: ['Chest', 'Triceps', 'Shoulders'], category: 'bodyweight' },
  // Shoulders & Arms
  { id: 'ohp', name: 'Overhead Press', muscleGroups: ['Shoulders', 'Triceps'], category: 'compound' },
  { id: 'lateral-raise', name: 'Lateral Raises', muscleGroups: ['Side Delts'], category: 'isolation' },
  { id: 'barbell-curl', name: 'Barbell Curl', muscleGroups: ['Biceps'], category: 'isolation' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', muscleGroups: ['Triceps'], category: 'isolation' },
  { id: 'face-pull', name: 'Face Pulls', muscleGroups: ['Rear Delts', 'Rotator Cuff'], category: 'isolation' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscleGroups: ['Biceps', 'Forearms'], category: 'isolation' },
];
