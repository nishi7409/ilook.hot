import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowTrendingUp,
  heroBolt,
  heroCheckCircle,
  heroChevronDown,
  heroChevronUp,
  heroClock,
  heroFire,
  heroPlayCircle,
  heroPlus,
  heroStopCircle,
  heroTrash,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { format } from 'date-fns';
import { ProgramService } from '../../services/program.service';
import { WorkoutService } from '../../services/workout.service';
import { EXERCISE_LIBRARY } from '../../services/exercise-library';

@Component({
  selector: 'app-workouts',
  imports: [NgIconComponent, NgxEchartsDirective, FormsModule],
  providers: [
    provideIcons({
      heroPlayCircle, heroStopCircle, heroPlus, heroXMark, heroTrash,
      heroBolt, heroFire, heroCheckCircle, heroArrowTrendingUp, heroClock,
      heroChevronUp, heroChevronDown,
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

  // Set logging state per exercise (exerciseId → { reps, weight, weightUnit })
  protected readonly setInputs = signal<Record<string, { reps: number; weight: number; weightUnit: 'lbs' | 'kg' }>>({});

  // Which exercise card is expanded
  protected readonly expandedExercise = signal<string | null>(null);

  // Elapsed timer (updated via effect or polling — we use a simple signal here)
  protected readonly elapsedLabel = signal('0:00');

  // Chart for selected exercise PR history
  protected readonly selectedExerciseId = signal<string | null>(null);

  protected readonly prChartOption = computed<EChartsOption>(() => {
    const id = this.selectedExerciseId();
    if (!id) return {};
    const history = this.workoutService.exerciseHistory(id);
    if (!history.length) return {};
    const labels = history.map((r) => format(new Date(r.date), 'MMM d'));
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

  protected readonly exercisePRs = computed(() =>
    EXERCISE_LIBRARY.map((ex) => {
      const history = this.workoutService.exerciseHistory(ex.id);
      if (!history.length) return null;
      const best = history.at(-1)!;
      const prev = history.length > 1 ? history[history.length - 2] : null;
      return { exercise: ex, weight: best.weight, unit: best.weightUnit, date: best.date, gain: prev ? best.weight - prev.weight : 0 };
    }).filter(Boolean),
  );

  startTodayWorkout(): void {
    const day = this.todayWorkout();
    if (!day || day.isRest) return;
    this.workoutService.startSession(day.name, day.exercises.map((e) => e.exercise));
    const inputs: Record<string, { reps: number; weight: number; weightUnit: 'lbs' | 'kg' }> = {};
    for (const ex of day.exercises) {
      const history = this.workoutService.exerciseHistory(ex.exercise.id);
      const lastWeight = history.length ? history[history.length - 1].weight : 0;
      const lastUnit = history.length ? history[history.length - 1].weightUnit : 'lbs';
      inputs[ex.exercise.id] = { reps: Number(ex.reps) || 8, weight: lastWeight, weightUnit: lastUnit };
    }
    this.setInputs.set(inputs);
    this.expandedExercise.set(day.exercises[0]?.exercise.id ?? null);
  }

  logSet(sessionExerciseId: string, exerciseId: string): void {
    const inp = this.setInputs()[exerciseId];
    if (!inp) return;
    this.workoutService.addSet(sessionExerciseId, inp.reps, inp.weight, inp.weightUnit);
  }

  finishWorkout(): void {
    this.workoutService.finishSession();
    this.expandedExercise.set(null);
    this.setInputs.set({});
  }

  discardWorkout(): void {
    this.workoutService.discardSession();
    this.expandedExercise.set(null);
    this.setInputs.set({});
  }

  updateReps(exerciseId: string, reps: number): void {
    this.setInputs.update((s) => ({ ...s, [exerciseId]: { ...s[exerciseId], reps } }));
  }

  updateWeight(exerciseId: string, weight: number): void {
    this.setInputs.update((s) => ({ ...s, [exerciseId]: { ...s[exerciseId], weight } }));
  }

  toggleUnit(exerciseId: string): void {
    this.setInputs.update((s) => {
      const cur = s[exerciseId];
      if (!cur) return s;
      return { ...s, [exerciseId]: { ...cur, weightUnit: cur.weightUnit === 'lbs' ? 'kg' : 'lbs' } };
    });
  }

  formatDuration(seconds?: number): string {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }
}
