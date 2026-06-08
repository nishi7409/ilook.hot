import { computed, DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type ThemePreference = 'dark' | 'light' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly STORAGE_KEY = 'ilook-theme';
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  /** The user's stored preference. */
  readonly preference = signal<ThemePreference>('system');

  /** The resolved theme after evaluating system preference. */
  readonly isDark = computed(() => {
    const pref = this.preference();
    if (pref === 'system') return this._systemDark();
    return pref === 'dark';
  });

  /** Label shown when preference is 'system'. */
  readonly systemLabel = computed(() =>
    this._systemDark() ? 'System (dark)' : 'System (light)',
  );

  /** Tracks the OS-level dark mode preference. */
  private readonly _systemDark = signal(false);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      this._systemDark.set(mq.matches);

      const handler = (e: MediaQueryListEvent) => {
        this._systemDark.set(e.matches);
        if (this.preference() === 'system') {
          this._apply(e.matches);
        }
      };
      mq.addEventListener('change', handler);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', handler));

      const pref = this._loadPreference();
      this.preference.set(pref);
      this._apply(pref === 'system' ? mq.matches : pref === 'dark');
    }
  }

  setPreference(pref: ThemePreference): void {
    this.preference.set(pref);
    this._apply(this.isDark());
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(ThemeService.STORAGE_KEY, pref);
    }
  }

  /**
   * Load preference from localStorage, migrating legacy boolean-style values.
   * Legacy values: 'dark' and 'light' are valid ThemePreference values already.
   * If a raw boolean string like 'true'/'false' were stored, migrate them.
   */
  private _loadPreference(): ThemePreference {
    const raw = localStorage.getItem(ThemeService.STORAGE_KEY);
    if (raw === null) return 'system';
    if (raw === 'dark' || raw === 'light' || raw === 'system') return raw;
    // Migrate legacy boolean-ish values
    if (raw === 'true') return 'dark';
    if (raw === 'false') return 'light';
    return 'system';
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
