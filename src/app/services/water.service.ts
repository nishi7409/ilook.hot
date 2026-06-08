import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { format } from 'date-fns';
import type { WaterLog, WaterGoal } from '../models/water.model';

interface WaterResponse {
  entries: WaterLog[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class WaterService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _entries = signal<WaterLog[]>([]);
  private readonly _total = signal(0);
  private readonly _goal = signal<WaterGoal>({ dailyGoalMl: 2500 });

  readonly entries = this._entries.asReadonly();
  readonly total = this._total.asReadonly();
  readonly goal = this._goal.asReadonly();

  readonly percent = computed(() => {
    const goalMl = this._goal().dailyGoalMl;
    return goalMl > 0 ? Math.min(100, Math.round((this._total() / goalMl) * 100)) : 0;
  });

  readonly remaining = computed(() => {
    return Math.max(0, this._goal().dailyGoalMl - this._total());
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadToday();
      this.loadGoal();
    }
  }

  private loadToday(): void {
    const today = format(new Date(), 'yyyy-MM-dd');
    this.http.get<WaterResponse>(`/api/water?date=${today}`).subscribe({
      next: (res) => {
        this._entries.set(res.entries);
        this._total.set(res.total);
      },
      error: () => {},
    });
  }

  private loadGoal(): void {
    this.http.get<WaterGoal>('/api/water/goals').subscribe({
      next: (goal) => this._goal.set(goal),
      error: () => {},
    });
  }

  addEntry(amount: number): void {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tempId = `temp-${Date.now()}`;
    const tempEntry: WaterLog = {
      id: tempId,
      date: today,
      amount,
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    this._entries.update((entries) => [tempEntry, ...entries]);
    this._total.update((t) => t + amount);

    this.http.post<WaterLog>('/api/water', { amount, date: today }).subscribe({
      next: (real) => {
        this._entries.update((entries) => entries.map((e) => (e.id === tempId ? real : e)));
      },
      error: () => {
        // Rollback
        this._entries.update((entries) => entries.filter((e) => e.id !== tempId));
        this._total.update((t) => Math.max(0, t - amount));
      },
    });
  }

  removeEntry(entryId: string): void {
    const entry = this._entries().find((e) => e.id === entryId);
    if (!entry) return;

    // Optimistic remove
    this._entries.update((entries) => entries.filter((e) => e.id !== entryId));
    this._total.update((t) => Math.max(0, t - entry.amount));

    this.http.delete(`/api/water/${entryId}`).subscribe({
      error: () => {
        // Rollback
        this._entries.update((entries) => [entry, ...entries]);
        this._total.update((t) => t + entry.amount);
      },
    });
  }

  updateGoal(dailyGoalMl: number): void {
    this._goal.set({ dailyGoalMl });
    this.http.put('/api/water/goals', { dailyGoalMl }).subscribe({ error: () => {} });
  }
}
