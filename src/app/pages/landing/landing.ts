import { ChangeDetectionStrategy, Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthModal } from '../../components/auth-modal/auth-modal';

interface MockCell {
  n: string | null;
  today?: boolean;
  pill?: string; pillBg?: string; pillColor?: string;
  pill2?: string; pill2Bg?: string; pill2Color?: string;
}

@Component({
  selector: 'app-landing',
  imports: [AuthModal, NgOptimizedImage],
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);

  protected readonly authOpen = signal(false);
  protected readonly authMode = signal<'signin' | 'signup'>('signup');

  protected readonly ghStars = signal(0);
  protected readonly ghForks = signal(0);
  protected readonly userCount = signal(0);
  protected readonly statsLoaded = signal(false);

  private animationFrameIds: number[] = [];

  constructor() {
    // Open modal automatically when redirected from auth guard
    const qp = this.route.snapshot.queryParamMap.get('auth');
    if (qp === 'signin' || qp === 'signup') {
      this.authMode.set(qp);
      this.authOpen.set(true);
    }
  }

  protected openAuth(mode: 'signin' | 'signup'): void {
    this.authMode.set(mode);
    this.authOpen.set(true);
  }

  protected closeAuth(): void {
    this.authOpen.set(false);
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  ngOnInit(): void {
    this.http.get<{ stars: number; forks: number; users: number }>('/api/stats').subscribe({
      next: (data) => {
        this.statsLoaded.set(true);
        this.animateCount(this.ghStars, data.stars);
        this.animateCount(this.ghForks, data.forks);
        this.animateCount(this.userCount, data.users);
      },
      error: () => {
        // Silently fail — stats are non-critical
      },
    });
  }

  ngOnDestroy(): void {
    for (const id of this.animationFrameIds) {
      cancelAnimationFrame(id);
    }
  }

  private animateCount(sig: ReturnType<typeof signal<number>>, target: number, durationMs = 1200): void {
    if (target <= 0) {
      sig.set(target);
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      sig.set(Math.round(eased * target));
      if (progress < 1) {
        this.animationFrameIds.push(requestAnimationFrame(step));
      }
    };
    this.animationFrameIds.push(requestAnimationFrame(step));
  }

  protected readonly heroStats = [
    { value: 'Free', label: 'always' },
    { value: 'Open', label: 'source' },
    { value: 'PWA', label: 'no app store' },
  ];

  protected readonly heroCalendarWeeks: MockCell[][] = [
    [
      { n: '18', pill: 'Legs', pillBg: '#ff775920', pillColor: '#ff7759' },
      { n: '19' },
      { n: '20', pill: 'Push', pillBg: '#4f46e520', pillColor: '#8b87ff' },
      { n: '21' },
      { n: '22', pill: 'Pull', pillBg: '#05966920', pillColor: '#34d399' },
      { n: '23' },
      { n: '24', pill: 'Legs', pillBg: '#ff775920', pillColor: '#ff7759' },
    ],
    [
      { n: '25' },
      { n: '26', pill: 'Push', pillBg: '#4f46e520', pillColor: '#8b87ff' },
      { n: '27' },
      { n: '28', pill: 'Pull', pillBg: '#05966920', pillColor: '#34d399' },
      { n: '29', pill: 'Legs', pillBg: '#ff775920', pillColor: '#ff7759', pill2: 'Push', pill2Bg: '#4f46e520', pill2Color: '#8b87ff' },
      { n: '30', today: true },
      { n: '31' },
    ],
  ];

  protected readonly mockExercises = [
    { name: 'Squat', muscle: 'Quads · Glutes', sets: '4×5' },
    { name: 'Romanian Deadlift', muscle: 'Hamstrings · Glutes', sets: '3×8' },
    { name: 'Leg Press', muscle: 'Quads', sets: '3×12' },
  ];

  /** Simplified calendar grid for the mockup (Mon-Sun, partial May) */
  protected readonly mockCalendarWeeks: MockCell[][] = [
    [
      { n: '27', pill: 'Legs', pillBg: '#ff775922', pillColor: '#ff7759' },
      { n: '28' },
      { n: '29', pill: 'Push', pillBg: '#4f46e522', pillColor: '#4f46e5' },
      { n: '30' },
      { n: '1' },
      { n: '2', pill: 'Legs', pillBg: '#ff775922', pillColor: '#ff7759' },
      { n: '3' },
    ],
    [
      { n: '4' },
      { n: '5', pill: 'Push', pillBg: '#4f46e522', pillColor: '#4f46e5' },
      { n: '6', pill: 'Legs', pillBg: '#ff775922', pillColor: '#ff7759', pill2: 'Pull', pill2Bg: '#05966922', pill2Color: '#059669' },
      { n: '7' },
      { n: '8' },
      { n: '9', pill: 'Legs', pillBg: '#ff775922', pillColor: '#ff7759' },
      { n: '10' },
    ],
    [
      { n: '11', pill: 'Pull', pillBg: '#05966922', pillColor: '#059669' },
      { n: '12' },
      { n: '13', pill: 'Push', pillBg: '#4f46e522', pillColor: '#4f46e5' },
      { n: '14' },
      { n: '15', pill: 'Legs', pillBg: '#ff775922', pillColor: '#ff7759' },
      { n: '16' },
      { n: '17', pill: 'Pull', pillBg: '#05966922', pillColor: '#059669' },
    ],
    [
      { n: '18' },
      { n: '19', pill: 'Push', pillBg: '#4f46e522', pillColor: '#4f46e5' },
      { n: '20' },
      { n: '21', pill: 'Legs', pillBg: '#ff775922', pillColor: '#ff7759' },
      { n: '22' },
      { n: '23', pill: 'Pull', pillBg: '#05966922', pillColor: '#059669' },
      { n: '24', pill: 'Push', pillBg: '#4f46e522', pillColor: '#4f46e5' },
    ],
    [
      { n: '25', pill: 'Legs', pillBg: '#ff775922', pillColor: '#ff7759' },
      { n: '26' },
      { n: '27', pill: 'Pull', pillBg: '#05966922', pillColor: '#059669' },
      { n: '28' },
      { n: '29', pill: 'Legs', pillBg: '#ff775922', pillColor: '#ff7759' },
      { n: '30', today: true },
      { n: '31' },
    ],
  ];

}
