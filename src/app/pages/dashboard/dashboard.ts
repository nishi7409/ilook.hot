import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowTrendingUp,
  heroBolt,
  heroCheckCircle,
  heroFire,
  heroPlayCircle,
  heroTrophy,
} from '@ng-icons/heroicons/outline';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { addDays, format } from 'date-fns';
import { NutritionService } from '../../services/nutrition.service';
import { ProgramService } from '../../services/program.service';
import { WorkoutService } from '../../services/workout.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  imports: [NgxEchartsDirective, NgIconComponent, RouterLink, DecimalPipe],
  providers: [provideIcons({ heroCheckCircle, heroFire, heroArrowTrendingUp, heroPlayCircle, heroBolt, heroTrophy })],
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col overflow-hidden min-w-0' },
})
export class Dashboard {
  protected readonly programService = inject(ProgramService);
  protected readonly nutritionService = inject(NutritionService);
  protected readonly workoutService = inject(WorkoutService);

  protected readonly today = { day: format(new Date(), 'EEEE'), date: format(new Date(), 'MMMM d, yyyy') };
  protected readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'good morning.' : h < 17 ? 'good afternoon.' : 'good evening.';
  })();
  protected readonly todayWorkout = this.programService.todayWorkout;
  protected readonly calories = this.nutritionService.todayTotals;
  protected readonly goals = this.nutritionService.goals;
  protected readonly recentSessions = this.workoutService.recentSessions;

  protected readonly weekSchedule = computed(() => {
    const schedEvents = this.programService.dayScheduleCalendarEvents();
    const legacyEvents = this.programService.calendarEvents();
    const programs = this.programService.programs();
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const now = new Date();
    const monday = addDays(now, -((now.getDay() + 6) % 7));

    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const dayKey = format(date, 'yyyy-MM-dd');

      // New schedule system first
      let programDay: { name: string; isRest: boolean } | null = null;
      const schedEvent = schedEvents.find((e) => format(e.date, 'yyyy-MM-dd') === dayKey);
      if (schedEvent) {
        const prog = programs.find((p) => p.id === schedEvent.programId);
        programDay = prog?.days.find((d) => d.id === schedEvent.dayId) ?? null;
      }
      // Legacy startDate fallback
      if (!programDay) {
        const legEvent = legacyEvents.find((e) => format(e.date, 'yyyy-MM-dd') === dayKey);
        if (legEvent) programDay = legEvent.day;
      }

      const session = this.workoutService.sessions().find((s) => s.date === dayKey);
      return {
        day: format(date, 'EEE'),
        date: format(date, 'd'),
        focus: programDay?.name ?? '—',
        isRest: programDay?.isRest ?? false,
        done: !!session?.completed,
        isToday: dayKey === todayKey,
        isPast: date < new Date() && dayKey !== todayKey,
      };
    });
  });

  protected readonly daysLoggedThisWeek = computed(() => this.weekSchedule().filter((d) => d.done).length);

  protected readonly sessionsThisWeek = computed(() => {
    const monday = (() => {
      const now = new Date();
      return addDays(now, -((now.getDay() + 6) % 7));
    })();
    const sunday = addDays(monday, 6);
    const monKey = format(monday, 'yyyy-MM-dd');
    const sunKey = format(sunday, 'yyyy-MM-dd');
    return this.workoutService.sessions().filter(
      (s) => s.completed && s.date >= monKey && s.date <= sunKey
    ).length;
  });

  protected readonly currentStreak = computed(() => {
    const sessions = this.workoutService.sessions().filter((s) => s.completed);
    if (!sessions.length) return 0;
    const dates = new Set(sessions.map((s) => s.date));
    let streak = 0;
    let cursor = new Date();
    // walk back from today
    for (let i = 0; i < 365; i++) {
      const key = format(addDays(cursor, -i), 'yyyy-MM-dd');
      if (dates.has(key)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    return streak;
  });

  /** Top exercise by total volume (sets × weight) — drives the progress card */
  protected readonly topExerciseStats = computed(() => {
    const prs = this.workoutService.exercisePRs();
    if (!prs.length) return null;
    const top = prs[0];
    const history = this.workoutService.exerciseHistory(top.exercise.id);
    if (history.length < 2) return { name: top.exercise.name, current: top.weight, unit: top.unit, gain: 0, history };
    const gain = history[history.length - 1].weight - history[0].weight;
    return { name: top.exercise.name, current: top.weight, unit: top.unit, gain, history };
  });

  protected readonly caloriePercent = computed(() => {
    const goal = this.goals().calories;
    return goal > 0 ? Math.min(100, Math.round((this.calories().calories / goal) * 100)) : 0;
  });

  protected readonly macros = computed(() => {
    const g = this.goals();
    const t = this.calories();
    return [
      { name: 'Protein', consumed: Math.round(t.protein), goal: g.protein, unit: 'g', percent: Math.min(100, Math.round((t.protein / g.protein) * 100)) },
      { name: 'Carbs', consumed: Math.round(t.carbs), goal: g.carbs, unit: 'g', percent: Math.min(100, Math.round((t.carbs / g.carbs) * 100)) },
      { name: 'Fat', consumed: Math.round(t.fat), goal: g.fat, unit: 'g', percent: Math.min(100, Math.round((t.fat / g.fat) * 100)) },
    ];
  });

  protected readonly calorieChartOption = computed<EChartsOption>(() => {
    const weekly = this.nutritionService.weeklyCalories();
    const goal = this.goals().calories;
    return {
      grid: { top: 24, right: 60, bottom: 28, left: 8, containLabel: false },
      xAxis: {
        type: 'category',
        data: weekly.map((d) => d.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 11, color: '#93939f', fontFamily: 'Inter, sans-serif' },
      },
      yAxis: { type: 'value', show: false, max: Math.max(goal * 1.1, 2700) },
      series: [{
        type: 'bar',
        barMaxWidth: 32,
        data: weekly.map((d) => ({
          value: d.calories || null,
          itemStyle: { color: format(d.date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? '#ff7759' : 'rgba(255,119,89,0.25)', borderRadius: [4, 4, 0, 0] },
        })),
        markLine: {
          silent: true, symbol: 'none',
          data: [{ yAxis: goal }],
          lineStyle: { color: '#d9d9dd', type: 'dashed', width: 1 },
          label: { formatter: `${goal.toLocaleString()} kcal`, position: 'end', color: '#93939f', fontSize: 10, fontFamily: 'Inter, sans-serif' },
        },
      }],
      tooltip: {
        trigger: 'axis',
        formatter: (p: any) => { const d = Array.isArray(p) ? p[0] : p; return d?.value ? `${d.name}: <strong>${Number(d.value).toLocaleString()} kcal</strong>` : ''; },
        backgroundColor: '#17171c', borderColor: 'transparent',
        textStyle: { color: '#fff', fontSize: 12, fontFamily: 'Inter, sans-serif' },
      },
    };
  });

  protected readonly squatChartOption = computed<EChartsOption>(() => {
    const stats = this.topExerciseStats();
    const historyRecords = stats?.history ?? [];
    const labels = historyRecords.map((r) => format(new Date(r.date + 'T00:00:00'), 'MMM d'));
    const data = historyRecords.map((r) => r.weight);

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

  protected formatDuration(seconds?: number): string {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }
}
