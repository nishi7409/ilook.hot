import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroAdjustmentsHorizontal,
  heroBars3,
  heroBolt,
  heroCalendarDays,
  heroCamera,
  heroFire,
  heroSquares2x2,
  heroXMark,
  heroArrowRightOnRectangle,
} from '@ng-icons/heroicons/outline';
import { ProgramService } from '../../services/program.service';
import { AuthService } from '../../services/auth.service';
import { AuthModal } from '../auth-modal/auth-modal';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgIconComponent, AuthModal, NgOptimizedImage],
  providers: [provideIcons({ heroSquares2x2, heroCalendarDays, heroFire, heroBolt, heroCamera, heroBars3, heroXMark, heroAdjustmentsHorizontal, heroArrowRightOnRectangle })],
  templateUrl: './app-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  protected readonly programService = inject(ProgramService);
  protected readonly authService = inject(AuthService);
  protected readonly showMobileMenu = signal(false);
  protected readonly showAuthModal = signal(false);
  protected readonly authMode = signal<'signin' | 'signup'>('signin');

  protected openAuth(mode: 'signin' | 'signup'): void {
    this.authMode.set(mode);
    this.showAuthModal.set(true);
  }
}
