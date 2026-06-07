import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowTrendingUp,
  heroBolt,
  heroCheckCircle,
  heroChevronDown,
  heroChevronRight,
  heroChevronUp,
  heroClock,
  heroFire,
  heroPlayCircle,
  heroStopCircle,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { format } from 'date-fns';
import { ProgramService } from '../../services/program.service';
import { WorkoutService } from '../../services/workout.service';
import type { SessionExercise, WorkoutSession } from '../../models/workout.model';
import type { WeightUnit } from '../../models/program.model';

interface SetDraftRow {
  reps: number;
  weight: number;
  weightUnit: WeightUnit;
  done: boolean;
}

@Component({
  selector: 'app-workouts',
  imports: [NgIconComponent, NgxEchartsDirective, FormsModule],
  providers: [
    provideIcons({
      heroPlayCircle, heroStopCircle, heroXMark, heroBolt, heroFire,
      heroCheckCircle, heroArrowTrendingUp, heroClock,
      heroChevronUp, heroChevronDown, heroChevronRight,
    }),
  ],
  templateUrl: './workouts.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col overflow-hidden min-w-0' },
})
export class Workouts {
  protected readonly workoutService = inject(WorkoutService);
  protected readonly programService = inject(ProgramService);

  protected readonly activeSession = this.workoutService.activeSession;
  protected readonly hasActiveSession = this.workoutService.hasActiveSession;
  protected readonly recentSessions = this.workoutService.recentSessions;
  protected readonly todayWorkout = this.programService.todayWorkout;
  protected readonly exercisePRs = this.workoutService.exercisePRs;

  /** Keyed by sessionExerciseId → array of per-set draft rows */
  protected readonly setDrafts = signal<Record<string, SetDraftRow[] | undefined>>({});

  /** Which exercise is currently expanded (by exercise id) */
  protected readonly expandedExerciseId = signal<string | null>(null);

  /** PR chart: which exercise to chart */
  protected readonly selectedExerciseId = signal<string | null>(null);

  /** Track which session we've already initialised drafts for */
  private readonly _initedSessionId = signal<string | null>(null);

  constructor() {
    // When an active session appears (start or resume), init set drafts
    effect(() => {
      const session = this.workoutService.activeSession();
      if (session && session.id !== this._initedSessionId()) {
        this._initDrafts(session);
        this._initedSessionId.set(session.id);
      } else if (!session) {
        this._initedSessionId.set(null);
        this.setDrafts.set({});
      }
    });

    // Re-init prefill when historical sessions finish loading (handles race
    // where sessions API resolves after the active session is already set)
    effect(() => {
      this.workoutService.sessions(); // track
      const session = this.workoutService.activeSession();
      if (!session) return;
      // Only patch rows that are still at weight=0 (weren't prefilled yet)
      this.setDrafts.update((drafts) => {
        let changed = false;
        const next = { ...drafts };
        for (const se of session.exercises) {
          const rows = drafts[se.id];
          if (!rows) continue;
          const hasUnfilled = rows.some((r) => !r.done && r.weight === 0);
          if (!hasUnfilled) continue;
          const history = this.workoutService.exerciseHistory(se.exercise.id);
          const last = history.at(-1);
          if (!last) continue;
          changed = true;
          next[se.id] = rows.map((r) =>
            r.done ? r : { ...r, weight: last.weight, weightUnit: last.weightUnit as WeightUnit, reps: r.reps },
          );
        }
        return changed ? next : drafts;
      });
    });
  }

  private _initDrafts(session: WorkoutSession): void {
    const drafts: Record<string, SetDraftRow[]> = {};
    for (const se of session.exercises) {
      // Already-logged sets from a resumed session
      const loggedSets = se.sets.filter((s) => s.completed);

      // Best prefill weight: last logged set in this session first,
      // then fall back to completed-session history
      const lastLoggedWeight = loggedSets.at(-1)?.weight ?? null;
      const lastLoggedUnit = (loggedSets.at(-1)?.weightUnit ?? null) as WeightUnit | null;
      const history = this.workoutService.exerciseHistory(se.exercise.id);
      const lastHistory = history.at(-1);
      const prefillWeight = lastLoggedWeight ?? lastHistory?.weight ?? 0;
      const prefillUnit: WeightUnit = lastLoggedUnit ?? (lastHistory?.weightUnit as WeightUnit) ?? 'lbs';

      drafts[se.id] = Array.from({ length: se.targetSets }, (_, i) => {
        const logged = loggedSets[i];
        if (logged) {
          return { reps: logged.reps, weight: logged.weight, weightUnit: logged.weightUnit as WeightUnit, done: true };
        }
        // Prefill pending rows with last known weight
        return { reps: se.targetReps, weight: prefillWeight, weightUnit: prefillUnit, done: false };
      });
    }
    this.setDrafts.set(drafts);
    // Auto-expand first incomplete exercise
    const firstIncomplete = session.exercises.find(
      (se) => drafts[se.id]?.some((r) => !r.done),
    ) ?? session.exercises[0];
    if (firstIncomplete) this.expandedExerciseId.set(firstIncomplete.exercise.id);
  }

  // ── Session actions ────────────────────────────────────────────────────────

  startTodayWorkout(): void {
    const day = this.todayWorkout();
    if (!day || day.isRest) return;
    this.workoutService.startSession(day.name, day.exercises);
  }

  finishWorkout(): void {
    this.workoutService.finishSession();
    this.expandedExerciseId.set(null);
  }

  discardWorkout(): void {
    this.workoutService.discardSession();
    this.expandedExerciseId.set(null);
  }

  // ── Set draft editing ─────────────────────────────────────────────────────

  updateSetDraft(seId: string, setIndex: number, field: 'reps' | 'weight', value: number): void {
    this.setDrafts.update((drafts) => ({
      ...drafts,
      [seId]: (drafts[seId] ?? []).map((row, i) =>
        i === setIndex ? { ...row, [field]: value } : row,
      ),
    }));
  }

  toggleUnit(seId: string, setIndex: number): void {
    this.setDrafts.update((drafts) => ({
      ...drafts,
      [seId]: (drafts[seId] ?? []).map((row, i) => {
        if (i !== setIndex) return row;
        const next: WeightUnit = row.weightUnit === 'lbs' ? 'kg' : 'lbs';
        return { ...row, weightUnit: next };
      }),
    }));
  }

  completeSet(seId: string, setIndex: number): void {
    const session = this.workoutService.activeSession();
    if (!session) return;
    const draft = this.setDrafts()[seId]?.[setIndex];
    if (!draft || draft.done) return;

    // Mark done optimistically
    this.setDrafts.update((drafts) => ({
      ...drafts,
      [seId]: (drafts[seId] ?? []).map((row, i) =>
        i === setIndex ? { ...row, done: true } : row,
      ),
    }));

    // Persist — roll back draft if API fails so the user can retry
    this.workoutService.logSet(session.id, seId, draft.reps, draft.weight, draft.weightUnit, () => {
      this.setDrafts.update((drafts) => ({
        ...drafts,
        [seId]: (drafts[seId] ?? []).map((row, i) =>
          i === setIndex ? { ...row, done: false } : row,
        ),
      }));
    });

    // Pre-fill next undone set only if its weight is still 0 (no history / not yet entered)
    this.setDrafts.update((drafts) => {
      const rows = drafts[seId] ?? [];
      const nextIndex = rows.findIndex((r, i) => i > setIndex && !r.done && r.weight === 0);
      if (nextIndex === -1) return drafts;
      return {
        ...drafts,
        [seId]: rows.map((row, i) =>
          i === nextIndex ? { ...row, weight: draft.weight, weightUnit: draft.weightUnit } : row,
        ),
      };
    });

    // Auto-advance: if all sets done, expand next incomplete exercise
    const allDone = (this.setDrafts()[seId] ?? []).every((r) => r.done);
    if (allDone) {
      const exercises = session.exercises;
      const idx = exercises.findIndex((e) => e.id === seId);
      const next = exercises.slice(idx + 1).find(
        (e) => (this.setDrafts()[e.id] ?? []).some((r) => !r.done),
      );
      if (next) this.expandedExerciseId.set(next.exercise.id);
    }
  }

  toggleExpand(exerciseId: string): void {
    this.expandedExerciseId.update((id) => (id === exerciseId ? null : exerciseId));
  }

  // ── Derived helpers ────────────────────────────────────────────────────────

  doneSetsCount(seId: string): number {
    return (this.setDrafts()[seId] ?? []).filter((r) => r.done).length;
  }

  allSetsDone(seId: string): boolean {
    const rows = this.setDrafts()[seId] ?? [];
    return rows.length > 0 && rows.every((r) => r.done);
  }

  totalSetsTarget(seId: string): number {
    return (this.setDrafts()[seId] ?? []).length;
  }

  protected readonly completedExerciseCount = computed(() => {
    const session = this.activeSession();
    if (!session) return 0;
    return session.exercises.filter((se) => this.allSetsDone(se.id)).length;
  });

  // ── PR chart ──────────────────────────────────────────────────────────────

  protected readonly prChartOption = computed<EChartsOption>(() => {
    const id = this.selectedExerciseId();
    if (!id) return {};
    const history = this.workoutService.exerciseHistory(id);
    if (!history.length) return {};
    const labels = history.map((r) => format(new Date(r.date + 'T00:00:00'), 'MMM d'));
    const data = history.map((r) => r.weight);
    return {
      grid: { top: 12, right: 12, bottom: 28, left: 52 },
      xAxis: { type: 'category', data: labels, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { fontSize: 11, color: '#93939f', fontFamily: 'Inter, sans-serif' } },
      yAxis: {
        type: 'value',
        min: data.length ? Math.floor(Math.min(...data) * 0.95) : 0,
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { fontSize: 11, color: '#93939f', formatter: '{value} lbs', fontFamily: 'Inter, sans-serif' },
        splitLine: { lineStyle: { color: '#f2f2f2' } },
      },
      series: [{
        type: 'line', data, smooth: 0.3, symbol: 'circle', symbolSize: 7,
        lineStyle: { color: '#ff7759', width: 2.5 },
        itemStyle: { color: '#ff7759', borderColor: '#fff', borderWidth: 2 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(255,119,89,0.18)' }, { offset: 1, color: 'rgba(255,119,89,0.02)' }] } },
      }],
      tooltip: {
        trigger: 'axis',
        formatter: (p: any) => { const d = Array.isArray(p) ? p[0] : p; return `${d.name}: <strong>${d.value} lbs</strong>`; },
        backgroundColor: '#17171c', borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12, fontFamily: 'Inter, sans-serif' },
      },
    };
  });

  formatDuration(seconds?: number): string {
    return this.workoutService.formatDuration(seconds);
  }
}
