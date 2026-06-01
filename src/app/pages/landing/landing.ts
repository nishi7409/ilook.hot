import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthModal } from '../../components/auth-modal/auth-modal';

interface MockCell {
  n: string | null;
  today?: boolean;
  pill?: string; pillBg?: string; pillColor?: string;
  pill2?: string; pill2Bg?: string; pill2Color?: string;
}

@Component({
  selector: 'app-landing',
  imports: [AuthModal],
  templateUrl: './landing.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly authOpen = signal(false);
  protected readonly authMode = signal<'signin' | 'signup'>('signup');

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
