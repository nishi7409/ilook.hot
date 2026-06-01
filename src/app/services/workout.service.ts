import { computed, Injectable, signal } from '@angular/core';
import { format } from 'date-fns';
import type { Exercise } from '../models/program.model';
import type { ExerciseRecord, SessionExercise, WorkoutSession, WorkoutSet } from '../models/workout.model';
import { EXERCISE_LIBRARY } from './exercise-library';

const ex = (id: string) => EXERCISE_LIBRARY.find((e) => e.id === id)!;

function makeSet(n: number, reps: number, weight: number, pr = false): WorkoutSet {
  return { id: `s-${Date.now()}-${n}`, setNumber: n, reps, weight, weightUnit: 'lbs', completed: true, isPersonalRecord: pr };
}

const MOCK_SESSIONS: WorkoutSession[] = [
  {
    id: 'sess-1',
    date: '2026-05-29',
    name: 'Chest',
    programDayId: 'day-chest',
    completed: true,
    durationSeconds: 3720,
    exercises: [
      { id: 'se-1', exercise: ex('bench'), notes: '', sets: [makeSet(1, 5, 175), makeSet(2, 5, 185), makeSet(3, 5, 185), makeSet(4, 5, 185, true)] },
      { id: 'se-2', exercise: ex('incline-db'), notes: '', sets: [makeSet(1, 10, 65), makeSet(2, 10, 70), makeSet(3, 8, 70)] },
      { id: 'se-3', exercise: ex('cable-fly'), notes: '', sets: [makeSet(1, 12, 40), makeSet(2, 12, 40), makeSet(3, 10, 45)] },
      { id: 'se-4', exercise: ex('pushup'), notes: '', sets: [makeSet(1, 20, 0), makeSet(2, 17, 0), makeSet(3, 15, 0)] },
    ],
  },
  {
    id: 'sess-2',
    date: '2026-05-27',
    name: 'Arms & Shoulders',
    programDayId: 'day-arms',
    completed: true,
    durationSeconds: 3300,
    exercises: [
      { id: 'se-5', exercise: ex('ohp'), notes: '', sets: [makeSet(1, 5, 110), makeSet(2, 5, 115), makeSet(3, 5, 115), makeSet(4, 5, 115)] },
      { id: 'se-6', exercise: ex('lateral-raise'), notes: '', sets: [makeSet(1, 15, 20), makeSet(2, 15, 20), makeSet(3, 12, 22)] },
      { id: 'se-7', exercise: ex('barbell-curl'), notes: '', sets: [makeSet(1, 10, 85), makeSet(2, 10, 85), makeSet(3, 8, 85)] },
      { id: 'se-8', exercise: ex('tricep-pushdown'), notes: '', sets: [makeSet(1, 12, 60), makeSet(2, 12, 60), makeSet(3, 10, 65)] },
    ],
  },
  {
    id: 'sess-3',
    date: '2026-05-26',
    name: 'Legs',
    programDayId: 'day-legs',
    completed: true,
    durationSeconds: 4200,
    exercises: [
      { id: 'se-9', exercise: ex('squat'), notes: '', sets: [makeSet(1, 5, 215), makeSet(2, 5, 225), makeSet(3, 5, 225), makeSet(4, 5, 225)] },
      { id: 'se-10', exercise: ex('rdl'), notes: '', sets: [makeSet(1, 8, 185), makeSet(2, 8, 185), makeSet(3, 8, 185)] },
      { id: 'se-11', exercise: ex('leg-press'), notes: '', sets: [makeSet(1, 12, 270), makeSet(2, 12, 270), makeSet(3, 12, 270)] },
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly _sessions = signal<WorkoutSession[]>(MOCK_SESSIONS);
  private readonly _activeSession = signal<WorkoutSession | null>(null);
  private readonly _sessionStart = signal<number | null>(null);

  readonly sessions = this._sessions.asReadonly();
  readonly activeSession = this._activeSession.asReadonly();
  readonly hasActiveSession = computed(() => this._activeSession() !== null);

  readonly recentSessions = computed(() => [...this._sessions()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10));

  exerciseHistory(exerciseId: string): ExerciseRecord[] {
    const records: ExerciseRecord[] = [];
    for (const session of this._sessions()) {
      for (const se of session.exercises) {
        if (se.exercise.id !== exerciseId) continue;
        const best = se.sets.filter((s) => s.completed).reduce<WorkoutSet | null>((max, s) => (!max || s.weight > max.weight ? s : max), null);
        if (best) records.push({ exerciseId, weight: best.weight, weightUnit: best.weightUnit, reps: best.reps, date: session.date });
      }
    }
    return records.sort((a, b) => a.date.localeCompare(b.date));
  }

  startSession(name: string, exercises: Exercise[]): void {
    const session: WorkoutSession = {
      id: `sess-${Date.now()}`,
      date: format(new Date(), 'yyyy-MM-dd'),
      name,
      completed: false,
      exercises: exercises.map((e, i) => ({
        id: `se-${Date.now()}-${i}`,
        exercise: e,
        sets: [],
      })),
    };
    this._activeSession.set(session);
    this._sessionStart.set(Date.now());
  }

  addSet(sessionExerciseId: string, reps: number, weight: number, weightUnit: 'lbs' | 'kg' = 'lbs'): void {
    this._activeSession.update((session) => {
      if (!session) return session;
      return {
        ...session,
        exercises: session.exercises.map((se) => {
          if (se.id !== sessionExerciseId) return se;
          const n = se.sets.length + 1;
          const prevBest = this.exerciseHistory(se.exercise.id).at(-1);
          const isPR = !!prevBest && weight > prevBest.weight;
          const newSet: WorkoutSet = {
            id: `s-${Date.now()}`,
            setNumber: n,
            reps,
            weight,
            weightUnit,
            completed: true,
            isPersonalRecord: isPR,
            completedAt: new Date().toISOString(),
          };
          return { ...se, sets: [...se.sets, newSet] };
        }),
      };
    });
  }

  finishSession(): void {
    const session = this._activeSession();
    if (!session) return;
    const duration = this._sessionStart() ? Math.round((Date.now() - this._sessionStart()!) / 1000) : undefined;
    const completed = { ...session, completed: true, durationSeconds: duration };
    this._sessions.update((s) => [completed, ...s]);
    this._activeSession.set(null);
    this._sessionStart.set(null);
  }

  discardSession(): void {
    this._activeSession.set(null);
    this._sessionStart.set(null);
  }
}
