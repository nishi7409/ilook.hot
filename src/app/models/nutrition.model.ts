export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'log';
export type FoodSource = 'openfoodfacts' | 'usda' | 'custom';

export interface FoodItem {
  id: string;
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  source: FoodSource;
}

export interface MealEntry {
  id: string;
  food: FoodItem;
  servings: number;
  mealType: MealType;
  loggedAt: string; // ISO
  // Computed totals for this entry
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyLog {
  date: string; // 'YYYY-MM-DD'
  entries: MealEntry[];
  calorieGoal: number;
  proteinGoal: number;
  carbGoal: number;
  fatGoal: number;
}

export interface NutritionGoals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
