import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { format } from 'date-fns';
import type { ProgramExercise, WeightUnit } from '../models/program.model';
import type { ExerciseRecord, SessionExercise, WorkoutSession, WorkoutSet } from '../models/workout.model';

@Injectable({ providedIn: 'root' })
export class WorkoutService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _sessions = signal<WorkoutSession[]>([]);
  private readonly _activeSession = signal<WorkoutSession | null>(null);
  private readonly _sessionStart = signal<number | null>(null);
  private readonly _totalSessions = signal(0);
  private readonly _currentPage = signal(1);
  private readonly _pageSize = signal(20);
  private readonly _loadingMore = signal(false);
  private readonly _hasMore = computed(() => this._sessions().length < this._totalSessions());

  readonly sessions = this._sessions.asReadonly();
  readonly activeSession = this._activeSession.asReadonly();
  readonly hasActiveSession = computed(() => this._activeSession() !== null);
  readonly loadingMore = this._loadingMore.asReadonly();
  readonly hasMore = this._hasMore;
  readonly recentSessions = computed(() =>
    [...this._sessions()].sort((a, b) => b.date.localeCompare(a.date)),
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadSessions();
      this.resumeActiveSession();
    }
  }

  private loadSessions(): void {
    this.http.get<{ sessions: WorkoutSession[]; total: number; page: number; limit: number }>(
      '/api/workouts?page=1&limit=20',
    ).subscribe({
      next: (res) => {
        this._sessions.set(res.sessions);
        this._totalSessions.set(res.total);
        this._currentPage.set(1);
      },
      error: (err) => console.error('Failed to load workout sessions', err),
    });
  }

  loadMoreSessions(): void {
    if (this._loadingMore() || !this._hasMore()) return;
    const nextPage = this._currentPage() + 1;
    const limit = this._pageSize();
    this._loadingMore.set(true);
    this.http.get<{ sessions: WorkoutSession[]; total: number; page: number; limit: number }>(
      `/api/workouts?page=${nextPage}&limit=${limit}`,
    ).subscribe({
      next: (res) => {
        this._sessions.update((s) => [...s, ...res.sessions]);
        this._totalSessions.set(res.total);
        this._currentPage.set(nextPage);
        this._loadingMore.set(false);
      },
      error: (err) => {
        console.error('Failed to load more sessions', err);
        this._loadingMore.set(false);
      },
    });
  }

  private resumeActiveSession(): void {
    this.http.get<WorkoutSession | null>('/api/workouts/active').subscribe({
      next: (session) => {
        if (session) {
          this._activeSession.set(session);
          this._sessionStart.set(Date.now());
        }
      },
      error: () => {},
    });
  }

  /** Best-weight record per session for an exercise — used for PR chart + pre-fill */
  exerciseHistory(exerciseId: string): ExerciseRecord[] {
    const records: ExerciseRecord[] = [];
    for (const session of this._sessions()) {
      for (const se of session.exercises) {
        if (se.exercise.id !== exerciseId) continue;
        const best = se.sets
          .filter((s) => s.completed)
          .reduce<WorkoutSet | null>(
            (max, s) => (!max || s.weight > max.weight ? s : max),
            null,
          );
        if (best) {
          records.push({
            exerciseId,
            weight: best.weight,
            weightUnit: best.weightUnit,
            reps: best.reps,
            date: session.date,
          });
        }
      }
    }
    return records.sort((a, b) => a.date.localeCompare(b.date));
  }

  /** All exercises that have at least one logged set, with best weight */
  readonly exercisePRs = computed(() => {
    const seenIds = new Set<string>();
    const results: { exercise: SessionExercise['exercise']; weight: number; unit: WeightUnit; date: string; gain: number }[] = [];
    for (const session of this._sessions()) {
      for (const se of session.exercises) {
        if (seenIds.has(se.exercise.id)) continue;
        const history = this.exerciseHistory(se.exercise.id);
        if (!history.length) continue;
        seenIds.add(se.exercise.id);
        const best = history.at(-1)!;
        const prev = history.length > 1 ? history[history.length - 2] : null;
        results.push({
          exercise: se.exercise,
          weight: best.weight,
          unit: best.weightUnit as WeightUnit,
          date: best.date,
          gain: prev ? best.weight - prev.weight : 0,
        });
      }
    }
    return results.sort((a, b) => b.weight - a.weight);
  });

  startSession(name: string, exercises: ProgramExercise[], programDayId?: string): void {
    const date = format(new Date(), 'yyyy-MM-dd');
    this.http
      .post<WorkoutSession>('/api/workouts', {
        date,
        name,
        programDayId,
        exercises: exercises.map((e) => ({
          exerciseId: e.exerciseId,
          exerciseName: e.exercise.name,
          muscleGroups: e.exercise.muscleGroups,
          category: e.exercise.category,
          targetSets: e.sets,
          targetReps: e.reps,
        })),
      })
      .subscribe({
        next: (session) => {
          this._activeSession.set(session);
          this._sessionStart.set(Date.now());
        },
        error: (err) => console.error('Failed to start session', err),
      });
  }

  logSet(
    sessionId: string,
    sessionExerciseId: string,
    reps: number,
    weight: number,
    weightUnit: WeightUnit = 'lbs',
    onError?: () => void,
  ): void {
    // Optimistic update
    const tempSet: WorkoutSet = {
      id: `temp-${Date.now()}`,
      setNumber: 0,
      reps,
      weight,
      weightUnit,
      completed: true,
      isPersonalRecord: false,
    };
    this._activeSession.update((s) => {
      if (!s) return s;
      return {
        ...s,
        exercises: s.exercises.map((se) =>
          se.id === sessionExerciseId
            ? { ...se, sets: [...se.sets, { ...tempSet, setNumber: se.sets.length + 1 }] }
            : se,
        ),
      };
    });

    // Persist
    this.http
      .post<WorkoutSet>(
        `/api/workouts/${sessionId}/exercises/${sessionExerciseId}/sets`,
        { reps, weight, weightUnit },
      )
      .subscribe({
        next: (realSet) => {
          // Replace temp set with real one
          this._activeSession.update((s) => {
            if (!s) return s;
            return {
              ...s,
              exercises: s.exercises.map((se) =>
                se.id === sessionExerciseId
                  ? {
                      ...se,
                      sets: se.sets.map((st) =>
                        st.id === tempSet.id ? realSet : st,
                      ),
                    }
                  : se,
              ),
            };
          });
        },
        error: (err) => {
          console.error('Failed to log set', err);
          // Roll back optimistic update in active session
          this._activeSession.update((s) => {
            if (!s) return s;
            return {
              ...s,
              exercises: s.exercises.map((se) =>
                se.id === sessionExerciseId
                  ? { ...se, sets: se.sets.filter((st) => st.id !== tempSet.id) }
                  : se,
              ),
            };
          });
          // Notify caller so draft state can be rolled back too
          onError?.();
        },
      });
  }

  finishSession(): void {
    const session = this._activeSession();
    if (!session) return;
    const duration = this._sessionStart()
      ? Math.round((Date.now() - this._sessionStart()!) / 1000)
      : undefined;

    // Optimistic: immediately move the active session (with all logged sets) into
    // _sessions. This ensures exerciseHistory() returns correct data for the next
    // session's prefill, even if set POST requests are still in-flight.
    const optimistic: WorkoutSession = { ...session, completed: true, durationSeconds: duration ?? undefined };
    this._sessions.update((s) => [optimistic, ...s]);
    this._activeSession.set(null);
    this._sessionStart.set(null);

    this.http
      .patch<WorkoutSession>(`/api/workouts/${session.id}/finish`, {
        durationSeconds: duration,
      })
      .subscribe({
        next: (confirmed) => {
          // Swap the optimistic entry with the server-confirmed one.
          // We preserve the optimistic sets if the server response is missing
          // any (in-flight saves that completed after the PATCH).
          this._sessions.update((s) =>
            s.map((sess) => {
              if (sess.id !== confirmed.id) return sess;
              // Merge: keep whichever exercises have more sets (optimistic wins ties)
              const mergedExercises = confirmed.exercises.map((ce) => {
                const oe = optimistic.exercises.find((e) => e.id === ce.id);
                return oe && oe.sets.length > ce.sets.length ? oe : ce;
              });
              return { ...confirmed, exercises: mergedExercises };
            }),
          );
        },
        error: (err) => {
          console.error('Failed to finish session', err);
          // Rollback: remove optimistic entry and restore active session
          this._sessions.update((s) => s.filter((sess) => sess.id !== session.id));
          this._activeSession.set(session);
          this._sessionStart.set(duration != null ? Date.now() - duration * 1000 : Date.now());
        },
      });
  }

  discardSession(): void {
    const session = this._activeSession();
    if (!session) return;
    this._activeSession.set(null);
    this._sessionStart.set(null);
    this.http
      .delete(`/api/workouts/${session.id}`)
      .subscribe({ error: (err) => console.error('Failed to discard session', err) });
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }

  // Analytics data
  private readonly _analytics = signal<AnalyticsData | null>(null);
  readonly analytics = this._analytics.asReadonly();

  loadAnalytics(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.http.get<AnalyticsData>('/api/workouts/analytics').subscribe({
      next: (data) => this._analytics.set(data),
      error: (err) => console.error('Failed to load analytics', err),
    });
  }
}

export interface Estimated1RM {
  exerciseId: string;
  exerciseName: string;
  muscleGroups: string[];
  estimated1RM: number;
  trend: 'up' | 'down' | 'same';
  weightUnit: string;
}

export interface VolumeData {
  weeks: string[];
  muscleGroups: { name: string; data: number[] }[];
}

export interface HeatmapDay {
  date: string;
  count: number;
}

export interface ConsistencyData {
  weeklySessionCounts: { week: string; count: number }[];
  currentStreak: number;
  longestStreak: number;
  thisWeekSessions: number;
}

export interface AnalyticsData {
  estimated1RMs: Estimated1RM[];
  volumeData: VolumeData;
  heatmapData: HeatmapDay[];
  consistency: ConsistencyData;
}
