import { ChangeDetectionStrategy, ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowLeft,
  heroArrowRight,
  heroBolt,
  heroCalendarDays,
  heroCheck,
  heroChevronLeft,
  heroChevronRight,
  heroPencilSquare,
  heroPlus,
  heroTrash,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import type { CalendarEvent } from 'angular-calendar';
import { CalendarModule, CalendarView } from 'angular-calendar';
import { addDays, addMonths, differenceInDays, format, startOfDay, subMonths } from 'date-fns';
import type {
  CalendarWorkoutEvent,
  DayScheduleCalendarEvent,
  DayScheduleEntry,
  Exercise,
  PendingExerciseSchedule,
  ProgramExercise,
} from '../../models/program.model';
import { EXERCISE_LIBRARY } from '../../services/exercise-library';
import { ProgramService } from '../../services/program.service';
import { AuthService } from '../../services/auth.service';

const PROGRAM_COLORS = ['#ff7759', '#4f46e5', '#059669', '#d97706', '#7c3aed'];

/** Union meta type attached to every CalendarEvent in this component */
type CalMeta =
  | { kind: 'cycle'; event: CalendarWorkoutEvent }
  | { kind: 'schedule'; scheduleId: string; dayId: string; dayName: string; date: Date; programId: string }
  | { kind: 'preview' };

@Component({
  selector: 'app-programs',
  imports: [NgIconComponent, CalendarModule, FormsModule, DatePipe],
  providers: [
    provideIcons({
      heroPlus, heroCheck, heroTrash, heroPencilSquare, heroCalendarDays,
      heroBolt, heroChevronLeft, heroChevronRight, heroXMark, heroArrowLeft, heroArrowRight,
    }),
  ],
  templateUrl: './programs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col overflow-hidden min-w-0' },
})
export class Programs {
  protected readonly CalendarView = CalendarView;
  protected readonly encodeURIComponent = encodeURIComponent;
  protected readonly programService = inject(ProgramService);
  protected readonly authService = inject(AuthService);
  protected readonly exerciseLibrary = EXERCISE_LIBRARY;
  protected readonly cdr = inject(ChangeDetectorRef);
  private readonly document = inject(DOCUMENT);

  /** Dynamic iCal URL — origin from current page, hash from authenticated user */
  protected readonly iCalUrl = computed(() => {
    const origin = this.document.location?.origin ?? 'https://ilook.hot';
    const userHash = this.authService.user()?.calendarHash ?? null;
    if (!userHash) return null;
    return `${origin}/calendar/user/${userHash}`;
  });

  // ── View ─────────────────────────────────────────────────────────────────
  protected readonly activeView = signal<'editor' | 'calendar'>('editor');
  protected readonly selectedDayId = signal<string | null>(null);
  protected readonly showAddExercise = signal(false);
  protected readonly editingExerciseId = signal<string | null>(null);
  protected readonly editDraft = signal<{ sets: number; reps: string }>({ sets: 3, reps: '8-12' });
  protected readonly renamingDayId = signal<string | null>(null);
  protected readonly renameDraft = signal('');
  protected readonly showProgramList = signal(false);
  protected readonly showNewProgram = signal(false);
  protected readonly newProgramName = signal('');
  protected readonly exerciseSearch = signal('');
  protected readonly calendarDate = signal(new Date());
  protected readonly today = () => new Date();

  // ── Selected date (bottom panel shows ALL events for this date) ──────────
  protected readonly selectedDate = signal<Date | null>(null);

  // ── Delete confirmation ───────────────────────────────────────────────────
  protected readonly deleteTarget = signal<DayScheduleCalendarEvent | null>(null);

  // ── Scheduling / drag-drop state ─────────────────────────────────────────
  protected readonly schedulingProgramId = signal<string | null>(null);
  protected readonly expandedCalProgramId = signal<string | null>(null);
  /** dayId → pending schedule */
  protected readonly pendingSchedules = signal<Record<string, PendingExerciseSchedule>>({});
  protected readonly draggingDayId = signal<string | null>(null);
  protected readonly dragOverDate = signal<string | null>(null);
  protected readonly showFrequencyModal = signal(false);
  protected readonly pendingDropDate = signal<Date | null>(null);
  protected readonly pendingDropDayId = signal<string | null>(null);
  protected readonly frequencyCount = signal(1);
  protected readonly frequencyUnit = signal<'day' | 'week' | 'month'>('week');
  /** Mobile scheduling — date string from <input type="date"> */
  protected readonly mobileDateStr = signal('');
  /** Mobile scheduling panel open */
  protected readonly showMobileScheduler = signal(false);
  /** iCal subscription modal */
  protected readonly showICalModal = signal(false);
  protected readonly iCalCopied = signal(false);

  copyICalUrl(): void {
    const url = this.iCalUrl();
    if (!url) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        this.iCalCopied.set(true);
        setTimeout(() => this.iCalCopied.set(false), 2000);
        this.cdr.markForCheck();
      });
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  protected readonly selectedProgram = this.programService.selectedProgram;

  protected readonly selectedDay = computed(() => {
    const program = this.selectedProgram();
    if (!program) return null;
    const dayId = this.selectedDayId();
    return program.days.find((d) => d.id === dayId) ?? program.days[0] ?? null;
  });

  protected readonly filteredExercises = computed(() => {
    const q = this.exerciseSearch().toLowerCase().trim();
    if (!q) return EXERCISE_LIBRARY;
    return EXERCISE_LIBRARY.filter(
      (e) => e.name.toLowerCase().includes(q) || e.muscleGroups.some((m) => m.toLowerCase().includes(q)),
    );
  });

  private readonly programColorMap = computed<Map<string, string>>(() => {
    const map = new Map<string, string>();
    this.programService.programs().forEach((p, i) => map.set(p.id, PROGRAM_COLORS[i % PROGRAM_COLORS.length]));
    return map;
  });

  protected readonly programColors = computed(() => this.programColorMap());

  /** Pending preview events — shown on calendar before saving */
  private readonly pendingCalendarEvents = computed<CalendarEvent<CalMeta>[]>(() => {
    const pending = this.pendingSchedules();
    const program = this.schedulingProgram();
    if (!program || !Object.keys(pending).length) return [];

    const today = startOfDay(new Date());
    const windowEnd = addDays(today, 90);
    const color = this.programColorMap().get(program.id) ?? '#ff7759';
    const events: CalendarEvent<CalMeta>[] = [];

    for (const [dayId, sched] of Object.entries(pending)) {
      const day = program.days.find((d) => d.id === dayId);
      if (!day) continue;

      let cursor = startOfDay(new Date(sched.startDate));
      while (cursor <= windowEnd) {
        events.push({
          start: new Date(cursor),
          title: day.name,
          color: { primary: color, secondary: `${color}22` },
          cssClass: 'cal-preview-event',
          meta: { kind: 'preview' },
        });
        if (sched.frequencyUnit === 'day') cursor = addDays(cursor, sched.frequencyCount);
        else if (sched.frequencyUnit === 'week') cursor = addDays(cursor, sched.frequencyCount * 7);
        else cursor = addMonths(cursor, sched.frequencyCount);
        if (differenceInDays(cursor, today) > 400) break;
      }
    }
    return events;
  });

  /** All calendar events: program cycles + saved schedules + pending previews */
  protected readonly calendarEvents = computed<CalendarEvent<CalMeta>[]>(() => {
    const colorMap = this.programColorMap();

    const cycleEvents = this.programService.calendarEvents().map((e): CalendarEvent<CalMeta> => {
      if (e.day.isRest) {
        return {
          start: e.date,
          title: 'Rest',
          color: { primary: '#d9d9dd', secondary: 'rgba(217,217,221,0.18)' },
          meta: { kind: 'cycle', event: e },
          cssClass: 'cal-rest-event',
        };
      }
      const color = colorMap.get(e.programId) ?? '#ff7759';
      return {
        start: e.date,
        title: e.day.name,
        color: { primary: color, secondary: `${color}18` },
        meta: { kind: 'cycle', event: e },
      };
    });

    const schedEvents = this.programService.dayScheduleCalendarEvents().map((e): CalendarEvent<CalMeta> => {
      const color = colorMap.get(e.programId) ?? '#ff7759';
      return {
        start: e.date,
        title: e.title,
        color: { primary: color, secondary: `${color}30` },
        meta: { kind: 'schedule', scheduleId: e.scheduleId, dayId: e.dayId, dayName: e.title, date: e.date, programId: e.programId },
      };
    });

    return [...cycleEvents, ...schedEvents, ...this.pendingCalendarEvents()];
  });

  protected readonly calendarTitle = computed(() => format(this.calendarDate(), 'MMMM yyyy'));

  protected readonly upcomingEvents = computed(() => {
    const base = this.calendarDate();
    const from = new Date(base.getFullYear(), base.getMonth(), 1);
    const to = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    return this.programService.calendarEvents()
      .filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  });

  protected readonly bottomPanelOpen = computed(() => this.selectedDate() !== null);

  /** All workout items for the selected date (cycle + saved schedules, no rest) */
  protected readonly selectedDayItems = computed<Array<{
    title: string;
    programName: string;
    programId: string;
    dayId: string;
    exercises: ProgramExercise[];
    scheduleEvent: DayScheduleCalendarEvent | null;
    date: Date;
  }>>(() => {
    const date = this.selectedDate();
    if (!date) return [];
    const iso = format(date, 'yyyy-MM-dd');
    const items: Array<{
      title: string; programName: string; programId: string; dayId: string;
      exercises: ProgramExercise[]; scheduleEvent: DayScheduleCalendarEvent | null; date: Date;
    }> = [];

    // Program cycle events (non-rest only)
    for (const e of this.programService.calendarEvents()) {
      if (!e.day.isRest && format(e.date, 'yyyy-MM-dd') === iso) {
        items.push({ title: e.day.name, programName: e.programName, programId: e.programId, dayId: e.day.id, exercises: e.day.exercises, scheduleEvent: null, date: e.date });
      }
    }
    // Saved day schedule events
    for (const e of this.programService.dayScheduleCalendarEvents()) {
      if (format(e.date, 'yyyy-MM-dd') === iso) {
        const program = this.programService.programs().find((p) => p.id === e.programId);
        const day = program?.days.find((d) => d.id === e.dayId);
        items.push({ title: e.title, programName: program?.name ?? '', programId: e.programId, dayId: e.dayId, exercises: day?.exercises ?? [], scheduleEvent: e, date: e.date });
      }
    }
    return items;
  });

  /**
   * Programs locked via the old cycle mode (startDate).
   * These are fully locked — no individual day scheduling.
   */
  protected readonly cycleLockedProgramIds = computed(() => {
    const ids = new Set<string>();
    for (const p of this.programService.programs()) {
      if (p.startDate) ids.add(p.id);
    }
    return ids;
  });

  /**
   * Individual dayIds that already have a saved DayScheduleEntry.
   * Per-day lock: even in a partially-scheduled program, only these days are frozen.
   */
  protected readonly scheduledDayIds = computed(() => {
    const ids = new Set<string>();
    for (const s of this.programService.daySchedules()) {
      ids.add(s.dayId);
    }
    return ids;
  });

  /**
   * Programs with any scheduling (for legend / "Scheduled" badge).
   */
  protected readonly scheduledProgramIds = computed(() => {
    const ids = new Set<string>();
    for (const p of this.programService.programs()) {
      if (p.startDate) ids.add(p.id);
    }
    for (const s of this.programService.daySchedules()) {
      ids.add(s.programId);
    }
    return ids;
  });

  protected readonly schedulingProgram = computed(() => {
    const id = this.schedulingProgramId();
    return id ? this.programService.programs().find((p) => p.id === id) ?? null : null;
  });

  protected readonly schedulingProgramDays = computed(() => {
    const prog = this.schedulingProgram();
    if (!prog) return [];
    return prog.days.filter((d) => !d.isRest);
  });

  protected readonly crossedDayIds = computed(() => new Set(Object.keys(this.pendingSchedules())));

  protected readonly allDaysScheduled = computed(() => {
    const days = this.schedulingProgramDays();
    if (!days.length) return false;
    const pending = this.crossedDayIds();
    const saved = this.scheduledDayIds();
    // All days must be either already saved or have a pending placement
    return days.every((d) => pending.has(d.id) || saved.has(d.id));
  });

  protected readonly frequencyPreview = computed(() => {
    const count = this.frequencyCount();
    const unit = this.frequencyUnit();
    const date = this.pendingDropDate();
    if (!date && !this.mobileDateStr()) return '';
    const startLabel = date
      ? format(date, 'MMM d')
      : this.mobileDateStr()
        ? format(new Date(this.mobileDateStr() + 'T00:00:00'), 'MMM d')
        : '—';
    return `Every ${count} ${unit}${count > 1 ? 's' : ''}, starting ${startLabel}`;
  });

  // ── Editor actions ────────────────────────────────────────────────────────

  selectProgram(id: string): void {
    this.programService.selectProgram(id);
    this.selectedDayId.set(null);
    this.showAddExercise.set(false);
  }

  activateProgram(id: string): void {
    this.programService.activateProgram(id);
  }

  selectDay(dayId: string): void {
    this.selectedDayId.set(dayId);
    this.showAddExercise.set(false);
  }

  createProgram(): void {
    const name = this.newProgramName().trim();
    if (!name) return;
    this.programService.createProgram(name);
    this.newProgramName.set('');
    this.showNewProgram.set(false);
    this.selectedDayId.set(null);
  }

  addDay(): void {
    const program = this.selectedProgram();
    if (!program) return;
    this.programService.addDay(program.id);
  }

  toggleRest(dayId: string): void {
    const program = this.selectedProgram();
    if (!program) return;
    this.programService.toggleRest(program.id, dayId);
  }

  addExerciseToDay(exercise: Exercise): void {
    const program = this.selectedProgram();
    const day = this.selectedDay();
    if (!program || !day) return;
    const pe: ProgramExercise = { exerciseId: exercise.id, exercise, sets: 3, reps: '8-12', weight: 0, weightUnit: 'lbs' };
    this.programService.addExercise(program.id, day.id, pe);
    this.showAddExercise.set(false);
    this.exerciseSearch.set('');
    this.startEdit(pe);
  }

  startEdit(ex: { exerciseId: string; sets: number; reps: string }): void {
    this.editingExerciseId.set(ex.exerciseId);
    this.editDraft.set({ sets: ex.sets, reps: ex.reps });
  }

  saveEdit(exerciseId: string): void {
    const program = this.selectedProgram();
    const day = this.selectedDay();
    if (!program || !day) return;
    this.programService.updateExercise(program.id, day.id, exerciseId, this.editDraft());
    this.editingExerciseId.set(null);
  }

  cancelEdit(): void { this.editingExerciseId.set(null); }

  startRename(day: { id: string; name: string }): void {
    this.renamingDayId.set(day.id);
    this.renameDraft.set(day.name);
  }

  saveRename(dayId: string): void {
    const name = this.renameDraft().trim();
    const program = this.selectedProgram();
    if (program && name) this.programService.renameDay(program.id, dayId, name);
    this.renamingDayId.set(null);
  }

  cancelRename(): void { this.renamingDayId.set(null); }

  removeExercise(exerciseId: string): void {
    const program = this.selectedProgram();
    const day = this.selectedDay();
    if (!program || !day) return;
    this.programService.removeExercise(program.id, day.id, exerciseId);
  }

  deleteProgram(id: string): void { this.programService.deleteProgram(id); }

  // ── Calendar view ─────────────────────────────────────────────────────────

  onDayClicked({ day }: { day: { date: Date; events: CalendarEvent<CalMeta>[] } }): void {
    this.selectedDate.set(startOfDay(day.date));
    this.cdr.markForCheck();
  }

  onEventClicked({ event }: { event: CalendarEvent<CalMeta> }): void {
    if (event.meta?.kind === 'preview') return;
    this.selectedDate.set(startOfDay(event.start));
    this.cdr.markForCheck();
  }

  closeBottomPanel(): void {
    this.selectedDate.set(null);
    this.cdr.markForCheck();
  }

  jumpToEditorDay(programId: string, dayId: string): void {
    this.programService.selectProgram(programId);
    this.selectedDayId.set(dayId);
    this.activeView.set('editor');
    this.closeBottomPanel();
  }

  prevMonth(): void { this.calendarDate.update((d) => subMonths(d, 1)); }
  nextMonth(): void { this.calendarDate.update((d) => addMonths(d, 1)); }

  // ── Delete ────────────────────────────────────────────────────────────────

  requestDelete(evt: DayScheduleCalendarEvent): void {
    this.deleteTarget.set(evt);
    this.cdr.markForCheck();
  }

  confirmDeleteOne(): void {
    const t = this.deleteTarget();
    if (!t) return;
    this.programService.deleteDayScheduleOccurrence(t.scheduleId, t.date);
    this.deleteTarget.set(null);
    this.closeBottomPanel();
  }

  confirmDeleteAll(): void {
    const t = this.deleteTarget();
    if (!t) return;
    this.programService.deleteDayScheduleFromDate(t.scheduleId, t.date);
    this.deleteTarget.set(null);
    this.closeBottomPanel();
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
    this.cdr.markForCheck();
  }

  // ── Scheduling sidebar ────────────────────────────────────────────────────

  toggleCalProgram(programId: string): void {
    this.expandedCalProgramId.update((id) => id === programId ? null : programId);
  }

  isDayCrossed(dayId: string): boolean {
    return this.crossedDayIds().has(dayId) || this.scheduledDayIds().has(dayId);
  }

  canDragFromProgram(programId: string): boolean {
    const id = this.schedulingProgramId();
    return id === null || id === programId;
  }

  // ── Drag-drop ─────────────────────────────────────────────────────────────

  onDayDragStart(event: DragEvent, dayId: string, programId: string): void {
    if (!this.canDragFromProgram(programId)) { event.preventDefault(); return; }
    this.schedulingProgramId.set(programId);
    this.expandedCalProgramId.set(programId);
    this.draggingDayId.set(dayId);
    event.dataTransfer?.setData('text/plain', dayId);
  }

  onDayDragEnd(): void {
    this.draggingDayId.set(null);
    if (!this.showFrequencyModal()) this.dragOverDate.set(null);
  }

  onCalendarDragOver(event: DragEvent, date: Date): void {
    if (!this.draggingDayId()) return;
    event.preventDefault();
    const iso = format(date, 'yyyy-MM-dd');
    if (this.dragOverDate() !== iso) { this.dragOverDate.set(iso); this.cdr.markForCheck(); }
  }

  onCalendarDragLeave(event: DragEvent, cellEl: Element): void {
    if (!cellEl.contains(event.relatedTarget as Node)) {
      this.dragOverDate.set(null);
      this.cdr.markForCheck();
    }
  }

  onCalendarDrop(event: DragEvent, date: Date): void {
    event.preventDefault();
    const dayId = this.draggingDayId();
    if (!dayId) return;
    this.draggingDayId.set(null);
    this.dragOverDate.set(null);
    this.pendingDropDayId.set(dayId);
    this.pendingDropDate.set(startOfDay(date));
    this.frequencyCount.set(1);
    this.frequencyUnit.set('week');
    this.showFrequencyModal.set(true);
    this.cdr.markForCheck();
  }

  isDragOver(date: Date): boolean { return this.dragOverDate() === format(date, 'yyyy-MM-dd'); }

  // ── Frequency modal ───────────────────────────────────────────────────────

  /** Open frequency modal from mobile "Schedule" button (no drag date) */
  openMobileDaySchedule(dayId: string, programId: string): void {
    if (!this.canDragFromProgram(programId)) return;
    this.schedulingProgramId.set(programId);
    this.expandedCalProgramId.set(programId);
    this.pendingDropDayId.set(dayId);
    this.pendingDropDate.set(null);
    this.mobileDateStr.set(format(new Date(), 'yyyy-MM-dd'));
    this.frequencyCount.set(1);
    this.frequencyUnit.set('week');
    this.showFrequencyModal.set(true);
    this.cdr.markForCheck();
  }

  confirmFrequency(): void {
    const dayId = this.pendingDropDayId();
    // Resolve date: from drag or from mobile date input
    const date = this.pendingDropDate() ?? (this.mobileDateStr()
      ? startOfDay(new Date(this.mobileDateStr() + 'T00:00:00'))
      : null);
    if (!dayId || !date) return;
    this.pendingSchedules.update((p) => ({ ...p, [dayId]: { startDate: date, frequencyCount: this.frequencyCount(), frequencyUnit: this.frequencyUnit() } }));
    this.showFrequencyModal.set(false);
    this.pendingDropDayId.set(null);
    this.pendingDropDate.set(null);
    this.mobileDateStr.set('');
    this.cdr.markForCheck();
  }

  cancelFrequency(): void {
    this.showFrequencyModal.set(false);
    this.pendingDropDayId.set(null);
    this.pendingDropDate.set(null);
    this.mobileDateStr.set('');
    if (!Object.keys(this.pendingSchedules()).length) this.schedulingProgramId.set(null);
  }

  // ── Save / Reset ──────────────────────────────────────────────────────────

  saveSchedule(): void {
    const programId = this.schedulingProgramId();
    if (!programId || !this.allDaysScheduled()) return;
    const pending = this.pendingSchedules();
    const prog = this.schedulingProgram();
    if (!prog) return;
    const now = Date.now();
    const entries: DayScheduleEntry[] = prog.days
      .filter((d) => !d.isRest && pending[d.id])
      .map((d) => ({
        id: `dsched-${now}-${d.id}`,
        programId,
        dayId: d.id,
        dayName: d.name,
        startDate: format(pending[d.id].startDate, 'yyyy-MM-dd'),
        frequencyCount: pending[d.id].frequencyCount,
        frequencyUnit: pending[d.id].frequencyUnit,
      }));
    this.programService.saveDaySchedules(programId, entries);
    this.programService.activateProgram(programId);
    this.resetScheduling();
  }

  resetScheduling(): void {
    this.schedulingProgramId.set(null);
    this.expandedCalProgramId.set(null);
    this.pendingSchedules.set({});
    this.draggingDayId.set(null);
    this.dragOverDate.set(null);
    this.showFrequencyModal.set(false);
    this.pendingDropDate.set(null);
    this.pendingDropDayId.set(null);
    this.cdr.markForCheck();
  }

  pendingScheduleLabel(dayId: string): string {
    const s = this.pendingSchedules()[dayId];
    if (s) return `every ${s.frequencyCount} ${s.frequencyUnit}${s.frequencyCount > 1 ? 's' : ''}`;
    if (this.scheduledDayIds().has(dayId)) return 'scheduled';
    return '';
  }

  scheduledDayCountForProgram(programId: string): number {
    return this.programService.daySchedules().filter((s) => s.programId === programId).length;
  }
}
