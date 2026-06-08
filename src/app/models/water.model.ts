export interface WaterLog {
  id: string;
  date: string; // yyyy-MM-dd
  amount: number; // ml
  createdAt: string; // ISO timestamp
}

export interface WaterGoal {
  dailyGoalMl: number;
}
