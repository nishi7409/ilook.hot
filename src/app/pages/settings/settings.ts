import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroBolt,
  heroCalendarDays,
  heroCheckCircle,
  heroFire,
} from '@ng-icons/heroicons/outline';
import type { NutritionGoals } from '../../models/nutrition.model';
import { NutritionService } from '../../services/nutrition.service';
import { ProgramService } from '../../services/program.service';

@Component({
  selector: 'app-settings',
  imports: [NgIconComponent, FormsModule, DecimalPipe, RouterLink],
  providers: [provideIcons({ heroFire, heroBolt, heroCalendarDays, heroCheckCircle })],
  templateUrl: './settings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col overflow-hidden min-w-0' },
})
export class Settings {
  protected readonly nutritionService = inject(NutritionService);
  protected readonly programService = inject(ProgramService);

  protected readonly goalsDraft = signal<NutritionGoals>({ ...this.nutritionService.goals() });
  protected readonly saved = signal(false);

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
}
