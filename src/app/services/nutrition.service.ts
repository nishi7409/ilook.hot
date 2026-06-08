import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { format } from 'date-fns';
import type { DailyLog, FoodItem, MealEntry, MealType, NutritionGoals } from '../models/nutrition.model';

const DEFAULT_GOALS: NutritionGoals = { calories: 2400, protein: 180, carbs: 250, fat: 80 };

function emptyLog(date: string, goals: NutritionGoals): DailyLog {
  return {
    date,
    entries: [],
    calorieGoal: goals.calories,
    proteinGoal: goals.protein,
    carbGoal: goals.carbs,
    fatGoal: goals.fat,
  };
}

@Injectable({ providedIn: 'root' })
export class NutritionService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _todayLog = signal<DailyLog>(emptyLog(format(new Date(), 'yyyy-MM-dd'), DEFAULT_GOALS));
  private readonly _goals = signal<NutritionGoals>(DEFAULT_GOALS);
  private readonly _weeklyData = signal<Record<string, number>>({});
  private readonly _searchQuery = signal('');

  readonly goals = this._goals.asReadonly();
  readonly todayLog = this._todayLog.asReadonly();

  readonly todayTotals = computed(() => {
    const entries = this._todayLog().entries;
    return entries.reduce(
      (acc, e) => ({
        calories: acc.calories + e.calories,
        protein: acc.protein + e.protein,
        carbs: acc.carbs + e.carbs,
        fat: acc.fat + e.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  });

  private readonly _searchResults = signal<FoodItem[]>([]);
  readonly searchResults = this._searchResults.asReadonly();

  readonly weeklyCalories = computed(() => {
    const data = this._weeklyData();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateKey = format(d, 'yyyy-MM-dd');
      return { date: d, label: format(d, 'EEE'), calories: data[dateKey] ?? 0 };
    });
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadGoals();
      this.loadTodayLog();
      this.loadWeekly();
    }
  }

  private loadGoals(): void {
    this.http.get<NutritionGoals>('/api/nutrition/goals').subscribe({
      next: (goals) => {
        this._goals.set(goals);
        this._todayLog.update((log) => ({
          ...log,
          calorieGoal: goals.calories,
          proteinGoal: goals.protein,
          carbGoal: goals.carbs,
          fatGoal: goals.fat,
        }));
      },
      error: () => {},
    });
  }

  private loadTodayLog(): void {
    const today = format(new Date(), 'yyyy-MM-dd');
    this.http.get<MealEntry[]>(`/api/nutrition/log?date=${today}`).subscribe({
      next: (entries) => {
        this._todayLog.set({
          date: today,
          entries,
          calorieGoal: this._goals().calories,
          proteinGoal: this._goals().protein,
          carbGoal: this._goals().carbs,
          fatGoal: this._goals().fat,
        });
      },
      error: () => {},
    });
  }

  private loadWeekly(): void {
    this.http.get<Record<string, number>>('/api/nutrition/weekly').subscribe({
      next: (data) => this._weeklyData.set(data),
      error: () => {},
    });
  }

  search(query: string): void {
    this._searchQuery.set(query);
    if (!query.trim()) {
      this._searchResults.set([]);
      return;
    }
    this.http
      .get<FoodItem[]>(`/api/nutrition/search?q=${encodeURIComponent(query.trim())}`)
      .subscribe({
        next: (results) => this._searchResults.set(results),
        error: () => this._searchResults.set([]),
      });
  }

  addEntry(food: FoodItem, servings: number, mealType: MealType): void {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tempId = `temp-${Date.now()}`;
    const loggedAt = new Date().toISOString();

    const tempEntry: MealEntry = {
      id: tempId,
      food,
      servings,
      mealType,
      loggedAt,
      calories: Math.round(food.calories * servings),
      protein: Math.round(food.protein * servings * 10) / 10,
      carbs: Math.round(food.carbs * servings * 10) / 10,
      fat: Math.round(food.fat * servings * 10) / 10,
    };

    // Optimistic update
    this._todayLog.update((log) => ({ ...log, entries: [...log.entries, tempEntry] }));
    this._weeklyData.update((d) => ({ ...d, [today]: (d[today] ?? 0) + tempEntry.calories }));

    this.http
      .post<MealEntry>('/api/nutrition/log', {
        foodId: food.id,
        foodName: food.name,
        brand: food.brand,
        servingSize: food.servingSize,
        servingUnit: food.servingUnit,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        mealType,
        servings,
        date: today,
        source: food.source,
      })
      .subscribe({
        next: (real) => {
          this._todayLog.update((log) => ({
            ...log,
            entries: log.entries.map((e) => (e.id === tempId ? real : e)),
          }));
        },
        error: () => {
          // Rollback
          this._todayLog.update((log) => ({
            ...log,
            entries: log.entries.filter((e) => e.id !== tempId),
          }));
          this._weeklyData.update((d) => ({ ...d, [today]: Math.max(0, (d[today] ?? 0) - tempEntry.calories) }));
        },
      });
  }

  removeEntry(entryId: string): void {
    const today = format(new Date(), 'yyyy-MM-dd');
    const entry = this._todayLog().entries.find((e) => e.id === entryId);
    if (!entry) return;

    // Optimistic remove
    this._todayLog.update((log) => ({ ...log, entries: log.entries.filter((e) => e.id !== entryId) }));
    this._weeklyData.update((d) => ({ ...d, [today]: Math.max(0, (d[today] ?? 0) - entry.calories) }));

    this.http.delete(`/api/nutrition/log/${entryId}`).subscribe({
      error: () => {
        // Rollback
        this._todayLog.update((log) => ({ ...log, entries: [...log.entries, entry] }));
        this._weeklyData.update((d) => ({ ...d, [today]: (d[today] ?? 0) + entry.calories }));
      },
    });
  }

  updateGoals(goals: NutritionGoals): void {
    this._goals.set(goals);
    this._todayLog.update((log) => ({
      ...log,
      calorieGoal: goals.calories,
      proteinGoal: goals.protein,
      carbGoal: goals.carbs,
      fatGoal: goals.fat,
    }));
    this.http.put('/api/nutrition/goals', goals).subscribe({ error: () => {} });
  }
}
