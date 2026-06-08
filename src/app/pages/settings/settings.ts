import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroBolt,
  heroCalendarDays,
  heroCheckCircle,
  heroComputerDesktop,
  heroFire,
  heroMoon,
  heroSun,
  heroArrowDownTray,
} from '@ng-icons/heroicons/outline';
import type { NutritionGoals } from '../../models/nutrition.model';
import { NutritionService } from '../../services/nutrition.service';
import { ProgramService } from '../../services/program.service';
import { ThemeService, type ThemePreference } from '../../services/theme.service';
import { WorkoutService } from '../../services/workout.service';
import { WaterService } from '../../services/water.service';

@Component({
  selector: 'app-settings',
  imports: [NgIconComponent, FormsModule, DecimalPipe],
  providers: [provideIcons({ heroFire, heroBolt, heroCalendarDays, heroCheckCircle, heroComputerDesktop, heroMoon, heroSun, heroArrowDownTray })],
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col overflow-hidden min-w-0' },
})
export class Settings {
  private readonly http = inject(HttpClient);
  protected readonly nutritionService = inject(NutritionService);
  protected readonly programService = inject(ProgramService);
  protected readonly themeService = inject(ThemeService);
  protected readonly workoutService = inject(WorkoutService);
  protected readonly waterService = inject(WaterService);

  protected readonly goalsDraft = signal<NutritionGoals>({ ...this.nutritionService.goals() });
  protected readonly waterGoalDraft = signal(this.waterService.goal().dailyGoalMl);
  protected readonly saved = signal(false);
  protected readonly waterSaved = signal(false);
  protected readonly exporting = signal(false);

  protected readonly themeOptions: { value: ThemePreference; label: string; icon: string }[] = [
    { value: 'dark', label: 'Dark', icon: 'heroMoon' },
    { value: 'light', label: 'Light', icon: 'heroSun' },
    { value: 'system', label: 'System', icon: 'heroComputerDesktop' },
  ];

  protected readonly activeThemeLabel = computed(() => {
    const pref = this.themeService.preference();
    if (pref === 'system') return this.themeService.systemLabel();
    return pref === 'dark' ? 'Dark theme active' : 'Light theme active';
  });

  protected readonly estimatedFromMacros = computed(() => {
    const d = this.goalsDraft();
    return d.protein * 4 + d.carbs * 4 + d.fat * 9;
  });

  updateGoalField(field: keyof NutritionGoals, value: number): void {
    this.goalsDraft.update((g) => ({ ...g, [field]: value }));
  }

  saveGoals(): void {
    this.nutritionService.updateGoals(this.goalsDraft());
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }

  saveWaterGoal(): void {
    this.waterService.updateGoal(this.waterGoalDraft());
    this.waterSaved.set(true);
    setTimeout(() => this.waterSaved.set(false), 2000);
  }

  downloadCsv(): void {
    const sessions = this.workoutService.sessions();
    if (!sessions.length) return;

    const rows: string[][] = [['Date', 'Session', 'Exercise', 'Set #', 'Reps', 'Weight (lbs)', 'Is PR', 'Duration (min)']];
    for (const session of sessions) {
      for (const ex of session.exercises) {
        ex.sets.forEach((set: { reps: number; weight?: number; isPersonalRecord?: boolean }, i: number) => {
          rows.push([
            session.date,
            session.name,
            ex.exercise.name,
            String(i + 1),
            String(set.reps),
            String(set.weight ?? ''),
            set.isPersonalRecord ? 'Yes' : 'No',
            i === 0 ? String(Math.round((session.durationSeconds ?? 0) / 60)) : '',
          ]);
        });
        if (!ex.sets.length) {
          rows.push([session.date, session.name, ex.exercise.name, '', '', '', '', '']);
        }
      }
    }

    const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ilook-hot-workouts-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  downloadFullExport(): void {
    this.exporting.set(true);
    this.http.get('/api/export').subscribe({
      next: (data) => {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ilook-hot-export-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false),
    });
  }
}
