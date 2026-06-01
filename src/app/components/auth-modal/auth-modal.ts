import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-auth-modal',
  imports: [ReactiveFormsModule],
  templateUrl: './auth-modal.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthModal {
  readonly initialMode = input<'signin' | 'signup'>('signup');
  readonly close = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly activeTab = signal<'signin' | 'signup'>('signup');
  protected readonly submitting = signal(false);
  protected readonly errorMsg = signal<string | null>(null);

  private readonly _syncMode = effect(() => {
    this.activeTab.set(this.initialMode());
  });

  protected readonly signupForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    acknowledgeDowntime: [false, Validators.requiredTrue],
  });

  protected readonly signinForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected onSubmitSignup(): void {
    if (this.signupForm.invalid || this.submitting()) return;
    const { email, password } = this.signupForm.value;
    this.submitting.set(true);
    this.errorMsg.set(null);

    this.authService.signUp(email!, password!).subscribe({
      next: (user) => {
        this.authService.user.set(user);
        this.submitting.set(false);
        this.close.emit();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Sign up failed. Try again.';
        this.errorMsg.set(msg);
        this.submitting.set(false);
      },
    });
  }

  protected onSubmitSignin(): void {
    if (this.signinForm.invalid || this.submitting()) return;
    const { email, password } = this.signinForm.value;
    this.submitting.set(true);
    this.errorMsg.set(null);

    this.authService.signIn(email!, password!).subscribe({
      next: (user) => {
        this.authService.user.set(user);
        this.submitting.set(false);
        this.close.emit();
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        const msg = err?.error?.error ?? 'Invalid email or password.';
        this.errorMsg.set(msg);
        this.submitting.set(false);
      },
    });
  }

  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}
