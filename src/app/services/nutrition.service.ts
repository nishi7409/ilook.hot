import { computed, Injectable, signal } from '@angular/core';
import { format } from 'date-fns';
import type { DailyLog, FoodItem, MealEntry, MealType, NutritionGoals } from '../models/nutrition.model';

const FOOD_DB: FoodItem[] = [
  { id: 'chicken-breast', name: 'Chicken Breast', brand: 'Generic', servingSize: 100, servingUnit: 'g', calories: 165, protein: 31, carbs: 0, fat: 3.6, source: 'usda' },
  { id: 'white-rice', name: 'White Rice (cooked)', brand: 'Generic', servingSize: 100, servingUnit: 'g', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, source: 'usda' },
  { id: 'eggs', name: 'Whole Egg', brand: 'Generic', servingSize: 1, servingUnit: 'large egg', calories: 70, protein: 6, carbs: 0.6, fat: 5, source: 'usda' },
  { id: 'oats', name: 'Rolled Oats', brand: 'Generic', servingSize: 40, servingUnit: 'g dry', calories: 148, protein: 5.5, carbs: 26, fat: 2.5, source: 'usda' },
  { id: 'banana', name: 'Banana', brand: 'Generic', servingSize: 1, servingUnit: 'medium', calories: 89, protein: 1.1, carbs: 23, fat: 0.3, source: 'openfoodfacts' },
  { id: 'greek-yogurt', name: 'Greek Yogurt', brand: 'Fage', servingSize: 170, servingUnit: 'g', calories: 90, protein: 16, carbs: 5, fat: 0, source: 'openfoodfacts' },
  { id: 'whey-protein', name: 'Whey Protein Shake', brand: 'Optimum Nutrition', servingSize: 1, servingUnit: 'scoop', calories: 120, protein: 24, carbs: 3, fat: 1, source: 'custom' },
  { id: 'salmon', name: 'Atlantic Salmon', brand: 'Generic', servingSize: 100, servingUnit: 'g', calories: 208, protein: 20, carbs: 0, fat: 13, source: 'usda' },
  { id: 'broccoli', name: 'Broccoli (steamed)', brand: 'Generic', servingSize: 100, servingUnit: 'g', calories: 35, protein: 2.4, carbs: 7, fat: 0.4, source: 'usda' },
  { id: 'sweet-potato', name: 'Sweet Potato', brand: 'Generic', servingSize: 1, servingUnit: 'medium', calories: 103, protein: 2.3, carbs: 24, fat: 0.1, source: 'usda' },
  { id: 'almonds', name: 'Almonds', brand: 'Generic', servingSize: 28, servingUnit: 'g (1 oz)', calories: 164, protein: 6, carbs: 6, fat: 14, source: 'usda' },
  { id: 'bread', name: 'Whole Wheat Bread', brand: 'Dave\'s Killer Bread', servingSize: 1, servingUnit: 'slice', calories: 100, protein: 5, carbs: 20, fat: 1.5, source: 'openfoodfacts' },
  { id: 'peanut-butter', name: 'Peanut Butter', brand: 'Jif Natural', servingSize: 2, servingUnit: 'tbsp', calories: 190, protein: 8, carbs: 7, fat: 16, source: 'openfoodfacts' },
  { id: 'ground-beef', name: 'Ground Beef 90/10', brand: 'Generic', servingSize: 100, servingUnit: 'g', calories: 176, protein: 20, carbs: 0, fat: 10, source: 'usda' },
  { id: 'pasta', name: 'Whole Wheat Pasta (cooked)', brand: 'Generic', servingSize: 140, servingUnit: 'g', calories: 200, protein: 8, carbs: 40, fat: 1.5, source: 'usda' },
];

function makeEntry(id: string, food: FoodItem, servings: number, mealType: MealType, loggedAt: string): MealEntry {
  return {
    id,
    food,
    servings,
    mealType,
    loggedAt,
    calories: Math.round(food.calories * servings),
    protein: Math.round(food.protein * servings * 10) / 10,
    carbs: Math.round(food.carbs * servings * 10) / 10,
    fat: Math.round(food.fat * servings * 10) / 10,
  };
}

const TODAY = format(new Date(), 'yyyy-MM-dd');

const MOCK_LOGS: Record<string, DailyLog> = {
  [TODAY]: {
    date: TODAY,
    calorieGoal: 2400,
    proteinGoal: 180,
    carbGoal: 250,
    fatGoal: 80,
    entries: [
      makeEntry('e1', FOOD_DB.find((f) => f.id === 'oats')!, 1, 'breakfast', `${TODAY}T07:30:00Z`),
      makeEntry('e2', FOOD_DB.find((f) => f.id === 'eggs')!, 3, 'breakfast', `${TODAY}T07:30:00Z`),
      makeEntry('e3', FOOD_DB.find((f) => f.id === 'banana')!, 1, 'breakfast', `${TODAY}T07:30:00Z`),
      makeEntry('e4', FOOD_DB.find((f) => f.id === 'greek-yogurt')!, 1, 'breakfast', `${TODAY}T08:00:00Z`),
      makeEntry('e5', FOOD_DB.find((f) => f.id === 'chicken-breast')!, 2, 'lunch', `${TODAY}T12:00:00Z`),
      makeEntry('e6', FOOD_DB.find((f) => f.id === 'white-rice')!, 1.5, 'lunch', `${TODAY}T12:00:00Z`),
      makeEntry('e7', FOOD_DB.find((f) => f.id === 'broccoli')!, 1.5, 'lunch', `${TODAY}T12:00:00Z`),
      makeEntry('e8', FOOD_DB.find((f) => f.id === 'whey-protein')!, 1, 'snack', `${TODAY}T16:00:00Z`),
      makeEntry('e9', FOOD_DB.find((f) => f.id === 'almonds')!, 1, 'snack', `${TODAY}T16:00:00Z`),
    ],
  },
};

@Injectable({ providedIn: 'root' })
export class NutritionService {
  private readonly _logs = signal<Record<string, DailyLog>>(MOCK_LOGS);
  private readonly _goals = signal<NutritionGoals>({ calories: 2400, protein: 180, carbs: 250, fat: 80 });
  private readonly _searchQuery = signal('');

  readonly goals = this._goals.asReadonly();
  readonly searchQuery = this._searchQuery.asReadonly();

  readonly todayLog = computed<DailyLog>(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return (
      this._logs()[today] ?? {
        date: today,
        entries: [],
        calorieGoal: this._goals().calories,
        proteinGoal: this._goals().protein,
        carbGoal: this._goals().carbs,
        fatGoal: this._goals().fat,
      }
    );
  });

  readonly todayTotals = computed(() => {
    const entries = this.todayLog().entries;
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

  readonly searchResults = computed<FoodItem[]>(() => {
    const q = this._searchQuery().toLowerCase().trim();
    if (!q) return FOOD_DB.slice(0, 8);
    return FOOD_DB.filter((f) => f.name.toLowerCase().includes(q) || f.brand?.toLowerCase().includes(q));
  });

  readonly weeklyCalories = computed(() => {
    const logs = this._logs();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dateKey = format(d, 'yyyy-MM-dd');
      const log = logs[dateKey];
      const total = log?.entries.reduce((s, e) => s + e.calories, 0) ?? 0;
      return { date: d, label: format(d, 'EEE'), calories: total };
    });
  });

  search(query: string): void {
    this._searchQuery.set(query);
  }

  addEntry(food: FoodItem, servings: number, mealType: MealType): void {
    const today = format(new Date(), 'yyyy-MM-dd');
    const entry = makeEntry(`e-${Date.now()}`, food, servings, mealType, new Date().toISOString());

    this._logs.update((logs) => {
      const existing = logs[today] ?? {
        date: today,
        entries: [],
        calorieGoal: this._goals().calories,
        proteinGoal: this._goals().protein,
        carbGoal: this._goals().carbs,
        fatGoal: this._goals().fat,
      };
      return { ...logs, [today]: { ...existing, entries: [...existing.entries, entry] } };
    });
  }

  removeEntry(entryId: string): void {
    const today = format(new Date(), 'yyyy-MM-dd');
    this._logs.update((logs) => {
      const log = logs[today];
      if (!log) return logs;
      return { ...logs, [today]: { ...log, entries: log.entries.filter((e) => e.id !== entryId) } };
    });
  }

  updateGoals(goals: NutritionGoals): void {
    this._goals.set(goals);
  }
}
