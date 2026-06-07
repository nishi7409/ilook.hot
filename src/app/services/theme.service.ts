import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly isDark = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const saved = localStorage.getItem('ilook-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const dark = saved ? saved === 'dark' : prefersDark;
      this.isDark.set(dark);
      this._apply(dark);
    }
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    this._apply(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('ilook-theme', next ? 'dark' : 'light');
    }
  }

  private _apply(dark: boolean): void {
    if (isPlatformBrowser(this.platformId)) {
      const html = document.documentElement;
      html.classList.toggle('dark', dark);
      // Tell the browser which color scheme is active so it styles
      // native form controls, scrollbars, and selection colours correctly.
      html.style.colorScheme = dark ? 'dark' : 'light';
    }
  }
}
