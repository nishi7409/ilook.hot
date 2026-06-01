import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

export interface AuthUser {
  id: string;
  email: string;
  calendarHash: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly platformId = inject(PLATFORM_ID);
  readonly user = signal<AuthUser | null>(null);
  readonly loading = signal(true);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }
    this.http.get<{ user: AuthUser | null }>('/api/auth/me').subscribe({
      next: ({ user }) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: () => {
        this.user.set(null);
        this.loading.set(false);
      },
    });
  }

  signUp(email: string, password: string) {
    return this.http.post<AuthUser>('/api/auth/signup', { email, password });
  }

  signIn(email: string, password: string) {
    return this.http.post<AuthUser>('/api/auth/signin', { email, password });
  }

  signOut(): void {
    this.http.post('/api/auth/signout', {}).subscribe(() => {
      this.user.set(null);
      this.router.navigate(['/']);
    });
  }
}
