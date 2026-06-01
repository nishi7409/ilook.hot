import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { addDays, addMonths, differenceInDays, format, startOfDay } from 'date-fns';
import type { CalendarWorkoutEvent, DayScheduleCalendarEvent, DayScheduleEntry, Program, ProgramDay, ProgramExercise } from '../models/program.model';

@Injectable({ providedIn: 'root' })
export class ProgramService {
  private readonly http = inject(HttpClient);

  private readonly _programs = signal<Program[]>([]);
  private readonly _selectedId = signal<string | null>(null);
  private readonly _daySchedules = signal<DayScheduleEntry[]>([]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly programs = this._programs.asReadonly();
  readonly daySchedules = this._daySchedules.asReadonly();
  readonly selectedProgram = computed(() =>
    this._programs().find((p) => p.id === this._selectedId()) ?? null,
  );
  readonly activeProgram = computed(() => this._programs().find((p) => p.isActive) ?? null);

  readonly calendarEvents = computed<CalendarWorkoutEvent[]>(() => {
    const today = startOfDay(new Date());
    const windowStart = addDays(today, -30);
    const windowEnd = addDays(today, 60);
    const allEvents: CalendarWorkoutEvent[] = [];

    for (const program of this._programs()) {
      if (!program.startDate || !program.days.length) continue;
      const start = startOfDay(new Date(program.startDate));
      const cursorStart = start >= windowStart ? start : windowStart;
      let cursor = new Date(cursorStart);

      while (cursor <= windowEnd) {
        const offset = differenceInDays(cursor, start);
        const dayIndex = ((offset % program.days.length) + program.days.length) % program.days.length;
        const day = program.days[dayIndex];
        allEvents.push({
          date: new Date(cursor),
          dayIndex,
          day,
          programId: program.id,
          programName: program.name,
          isActive: program.isActive,
        });
        cursor = addDays(cursor, 1);
      }
    }
    return allEvents;
  });

  readonly todayWorkout = computed<ProgramDay | null>(() => {
    const program = this.activeProgram();
    if (!program?.startDate) return null;
    const start = startOfDay(new Date(program.startDate));
    const today = startOfDay(new Date());
    const offset = differenceInDays(today, start);
    const idx = ((offset % program.days.length) + program.days.length) % program.days.length;
    return program.days[idx] ?? null;
  });

  readonly dayScheduleCalendarEvents = computed<DayScheduleCalendarEvent[]>(() => {
    const today = startOfDay(new Date());
    const windowStart = addDays(today, -30);
    const windowEnd = addDays(today, 90);
    const events: DayScheduleCalendarEvent[] = [];

    for (const sched of this._daySchedules()) {
      const excluded = new Set(sched.excludedDates ?? []);
      const end = sched.endDate ? startOfDay(new Date(sched.endDate)) : null;
      let cursor = startOfDay(new Date(sched.startDate));

      while (cursor <= windowEnd) {
        if (end && cursor >= end) break;
        const iso = format(cursor, 'yyyy-MM-dd');
        if (cursor >= windowStart && !excluded.has(iso)) {
          events.push({
            date: new Date(cursor),
            title: sched.dayName,
            programId: sched.programId,
            dayId: sched.dayId,
            scheduleId: sched.id,
          });
        }
        if (sched.frequencyUnit === 'day') cursor = addDays(cursor, sched.frequencyCount);
        else if (sched.frequencyUnit === 'week') cursor = addDays(cursor, sched.frequencyCount * 7);
        else cursor = addMonths(cursor, sched.frequencyCount);
        if (differenceInDays(cursor, today) > 400) break;
      }
    }
    return events;
  });

  private readonly platformId = inject(PLATFORM_ID);

  constructor() {
    // Skip HTTP calls during SSR — data loads client-side only
    if (isPlatformBrowser(this.platformId)) {
      this.loadPrograms();
      this.loadSchedules();
    }
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  private loadPrograms(): void {
    this.loading.set(true);
    this.http.get<Program[]>('/api/programs').subscribe({
      next: (programs) => {
        this._programs.set(programs);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load programs', err);
        this.error.set('Failed to load programs');
        this.loading.set(false);
      },
    });
  }

  private loadSchedules(): void {
    this.http.get<DayScheduleEntry[]>('/api/schedules').subscribe({
      next: (schedules) => this._daySchedules.set(schedules),
      error: (err) => console.error('Failed to load schedules', err),
    });
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  selectProgram(id: string): void {
    this._selectedId.set(id);
  }

  // ── Program mutations ─────────────────────────────────────────────────────

  createProgram(name: string): void {
    this.http.post<Program>('/api/programs', { name }).subscribe({
      next: (program) => {
        this._programs.update((p) => [...p, program]);
        this._selectedId.set(program.id);
      },
      error: (err) => console.error('Failed to create program', err),
    });
  }

  deleteProgram(id: string): void {
    // Optimistic update
    this._programs.update((programs) => programs.filter((p) => p.id !== id));
    if (this._selectedId() === id) this._selectedId.set(null);

    this.http.delete(`/api/programs/${id}`).subscribe({
      error: () => this.loadPrograms(),
    });
  }

  activateProgram(id: string): void {
    // Optimistic update
    this._programs.update((programs) =>
      programs.map((p) => ({ ...p, isActive: p.id === id })),
    );

    this.http.post<Program>(`/api/programs/${id}/activate`, {}).subscribe({
      next: (updated) => {
        this._programs.update((programs) =>
          programs.map((p) => (p.id === id ? updated : { ...p, isActive: false })),
        );
      },
      error: () => this.loadPrograms(),
    });
  }

  setStartDate(id: string, date: string): void {
    // Optimistic update
    this._programs.update((programs) =>
      programs.map((p) =>
        p.id === id ? { ...p, startDate: date, updatedAt: new Date().toISOString() } : p,
      ),
    );

    this.http.patch<Program>(`/api/programs/${id}`, { startDate: date }).subscribe({
      next: (updated) => {
        this._programs.update((programs) =>
          programs.map((p) => (p.id === id ? updated : p)),
        );
      },
      error: () => this.loadPrograms(),
    });
  }

  // ── Day mutations ─────────────────────────────────────────────────────────

  addDay(programId: string): void {
    const prog = this._programs().find((p) => p.id === programId);
    const dayNum = (prog?.days.length ?? 0) + 1;
    const name = `Day ${dayNum}`;

    this.http.post<Program>(`/api/programs/${programId}/days`, { name }).subscribe({
      next: (updated) => {
        this._programs.update((programs) =>
          programs.map((p) => (p.id === programId ? updated : p)),
        );
      },
      error: (err) => console.error('Failed to add day', err),
    });
  }

  renameDay(programId: string, dayId: string, name: string): void {
    // Optimistic update
    this._programs.update((programs) =>
      programs.map((p) => {
        if (p.id !== programId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          days: p.days.map((d) => (d.id === dayId ? { ...d, name } : d)),
        };
      }),
    );

    this.http.patch<Program>(`/api/programs/${programId}/days/${dayId}`, { name }).subscribe({
      next: (updated) => {
        this._programs.update((programs) =>
          programs.map((p) => (p.id === programId ? updated : p)),
        );
      },
      error: () => this.loadPrograms(),
    });
  }

  toggleRest(programId: string, dayId: string): void {
    const prog = this._programs().find((p) => p.id === programId);
    const day = prog?.days.find((d) => d.id === dayId);
    if (!day) return;
    const newIsRest = !day.isRest;

    // Optimistic update
    this._programs.update((programs) =>
      programs.map((p) => {
        if (p.id !== programId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          days: p.days.map((d) =>
            d.id === dayId
              ? { ...d, isRest: newIsRest, exercises: newIsRest ? [] : d.exercises }
              : d,
          ),
        };
      }),
    );

    this.http
      .patch<Program>(`/api/programs/${programId}/days/${dayId}`, { isRest: newIsRest })
      .subscribe({
        next: (updated) => {
          this._programs.update((programs) =>
            programs.map((p) => (p.id === programId ? updated : p)),
          );
        },
        error: () => this.loadPrograms(),
      });
  }

  // ── Exercise mutations ────────────────────────────────────────────────────

  addExercise(programId: string, dayId: string, exercise: ProgramExercise): void {
    // Optimistic update
    this._programs.update((programs) =>
      programs.map((p) => {
        if (p.id !== programId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          days: p.days.map((d) =>
            d.id === dayId ? { ...d, exercises: [...d.exercises, exercise] } : d,
          ),
        };
      }),
    );

    this.http
      .post<Program>(`/api/programs/${programId}/days/${dayId}/exercises`, exercise)
      .subscribe({
        next: (updated) => {
          this._programs.update((programs) =>
            programs.map((p) => (p.id === programId ? updated : p)),
          );
        },
        error: () => this.loadPrograms(),
      });
  }

  updateExercise(
    programId: string,
    dayId: string,
    exerciseId: string,
    updates: { sets?: number; reps?: string; weight?: number; weightUnit?: 'lbs' | 'kg'; notes?: string },
  ): void {
    const prog = this._programs().find((p) => p.id === programId);
    const day = prog?.days.find((d) => d.id === dayId);
    const ex = day?.exercises.find((e) => e.exerciseId === exerciseId);
    const rowId = ex?.rowId;

    // Optimistic update
    this._programs.update((programs) =>
      programs.map((p) => {
        if (p.id !== programId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          days: p.days.map((d) =>
            d.id !== dayId
              ? d
              : {
                  ...d,
                  exercises: d.exercises.map((e) =>
                    e.exerciseId === exerciseId ? { ...e, ...updates } : e,
                  ),
                },
          ),
        };
      }),
    );

    if (!rowId) {
      // No row ID yet (optimistic insert not yet confirmed) — reload to sync
      setTimeout(() => this.loadPrograms(), 500);
      return;
    }

    this.http
      .patch<Program>(`/api/programs/${programId}/days/${dayId}/exercises/${rowId}`, updates)
      .subscribe({
        next: (updated) => {
          this._programs.update((programs) =>
            programs.map((p) => (p.id === programId ? updated : p)),
          );
        },
        error: () => this.loadPrograms(),
      });
  }

  removeExercise(programId: string, dayId: string, exerciseId: string): void {
    const prog = this._programs().find((p) => p.id === programId);
    const day = prog?.days.find((d) => d.id === dayId);
    const ex = day?.exercises.find((e) => e.exerciseId === exerciseId);
    const rowId = ex?.rowId;

    // Optimistic update
    this._programs.update((programs) =>
      programs.map((p) => {
        if (p.id !== programId) return p;
        return {
          ...p,
          updatedAt: new Date().toISOString(),
          days: p.days.map((d) =>
            d.id === dayId
              ? { ...d, exercises: d.exercises.filter((e) => e.exerciseId !== exerciseId) }
              : d,
          ),
        };
      }),
    );

    if (!rowId) {
      setTimeout(() => this.loadPrograms(), 300);
      return;
    }

    this.http
      .delete<Program>(`/api/programs/${programId}/days/${dayId}/exercises/${rowId}`)
      .subscribe({
        next: (updated) => {
          this._programs.update((programs) =>
            programs.map((p) => (p.id === programId ? updated : p)),
          );
        },
        error: () => this.loadPrograms(),
      });
  }

  // ── Schedule mutations ────────────────────────────────────────────────────

  saveDaySchedules(programId: string, entries: DayScheduleEntry[]): void {
    // Optimistic update
    this._daySchedules.update((existing) => [
      ...existing.filter((s) => s.programId !== programId),
      ...entries,
    ]);

    this.http
      .post<DayScheduleEntry[]>('/api/schedules', { programId, entries })
      .subscribe({
        next: (saved) => {
          this._daySchedules.update((existing) => [
            ...existing.filter((s) => s.programId !== programId),
            ...saved,
          ]);
        },
        error: () => this.loadSchedules(),
      });
  }

  clearDaySchedules(programId: string): void {
    // Optimistic update
    this._daySchedules.update((existing) => existing.filter((s) => s.programId !== programId));

    this.http.post<DayScheduleEntry[]>('/api/schedules', { programId, entries: [] }).subscribe({
      error: () => this.loadSchedules(),
    });
  }

  deleteDayScheduleOccurrence(scheduleId: string, date: Date): void {
    const iso = format(date, 'yyyy-MM-dd');

    // Optimistic update
    this._daySchedules.update((existing) =>
      existing.map((s) =>
        s.id !== scheduleId
          ? s
          : { ...s, excludedDates: [...(s.excludedDates ?? []), iso] },
      ),
    );

    this.http
      .delete<DayScheduleEntry>(`/api/schedules/${scheduleId}/occurrence`, { body: { date: iso } })
      .subscribe({
        next: (updated) => {
          this._daySchedules.update((existing) =>
            existing.map((s) => (s.id === scheduleId ? updated : s)),
          );
        },
        error: () => this.loadSchedules(),
      });
  }

  deleteDayScheduleFromDate(scheduleId: string, date: Date): void {
    const iso = format(date, 'yyyy-MM-dd');
    const sched = this._daySchedules().find((s) => s.id === scheduleId);

    // Optimistic update
    this._daySchedules.update((existing) =>
      existing
        .map((s) => {
          if (s.id !== scheduleId) return s;
          if (s.startDate === iso) return null;
          return { ...s, endDate: iso };
        })
        .filter((s): s is DayScheduleEntry => s !== null),
    );

    this.http
      .delete<{ ok: boolean; deleted?: boolean } | DayScheduleEntry>(
        `/api/schedules/${scheduleId}/from-date`,
        { body: { date: iso } },
      )
      .subscribe({
        next: (res) => {
          if ('deleted' in res && res.deleted) {
            // Already removed optimistically
          } else if ('id' in res) {
            this._daySchedules.update((existing) =>
              existing.map((s) => (s.id === scheduleId ? (res as DayScheduleEntry) : s)),
            );
          }
          void sched;
        },
        error: () => this.loadSchedules(),
      });
  }
}
