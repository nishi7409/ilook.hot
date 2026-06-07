import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import type { Exercise } from '../models/program.model';

export interface ExerciseGroup {
  name: string;
  exercises: Exercise[];
}

const GROUP_ORDER = [
  'Top Picks',
  'Chest',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Legs',
  'Back',
  'Glutes',
  'Abs',
  'Calves',
  'Forearms & Grip',
  'Neck',
  'Cardio',
];

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly exercises = signal<Exercise[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Exercises grouped for display: Top Picks first, then by muscle group. */
  readonly groups = computed<ExerciseGroup[]>(() => {
    const all = this.exercises();
    if (!all.length) return [];

    const topPicks = all.filter((e) => e.topRated);
    const groupMap = new Map<string, Exercise[]>();
    for (const e of all) {
      const list = groupMap.get(e.group) ?? [];
      list.push(e);
      groupMap.set(e.group, list);
    }

    const result: ExerciseGroup[] = [];
    if (topPicks.length) result.push({ name: 'Top Picks', exercises: topPicks });
    for (const name of GROUP_ORDER) {
      if (name === 'Top Picks') continue;
      const exs = groupMap.get(name);
      if (exs?.length) result.push({ name, exercises: exs });
    }
    // Any group not in the order list goes at end
    for (const [name, exs] of groupMap) {
      if (!GROUP_ORDER.includes(name)) result.push({ name, exercises: exs });
    }
    return result;
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  private load(): void {
    this.loading.set(true);
    this.http.get<Exercise[]>('/api/exercises').subscribe({
      next: (data) => {
        this.exercises.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load exercises', err);
        this.error.set('Failed to load exercises');
        this.loading.set(false);
      },
    });
  }

  /** Filter exercises by search query — searches name and muscleGroups. */
  search(query: string): Exercise[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.exercises();
    return this.exercises().filter(
      (e) => e.name.toLowerCase().includes(q) || e.muscleGroups.some((m) => m.toLowerCase().includes(q)),
    );
  }
}
