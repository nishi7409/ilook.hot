import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _supported = signal(false);
  private readonly _subscribed = signal(false);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  readonly supported = this._supported.asReadonly();
  readonly subscribed = this._subscribed.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  readonly statusText = computed(() => {
    if (!this._supported()) return 'Push notifications not supported in this browser';
    if (this._loading()) return 'Working…';
    if (this._subscribed()) return 'Workout reminders enabled';
    return 'Workout reminders disabled';
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this._supported.set('serviceWorker' in navigator && 'PushManager' in window);
      this.checkExistingSubscription();
    }
  }

  private async checkExistingSubscription(): Promise<void> {
    if (!this._supported()) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        this._subscribed.set(sub !== null);
      }
    } catch {
      // ignore
    }
  }

  async subscribe(): Promise<void> {
    if (!this._supported()) return;
    this._loading.set(true);
    this._error.set(null);

    try {
      // Get VAPID key from server
      const { publicKey } = await firstValueFrom(
        this.http.get<{ publicKey: string }>('/api/push/vapid-key'),
      );

      // Register service worker
      const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey),
      });

      const subJson = sub.toJSON();

      // Send to server
      await firstValueFrom(
        this.http.post('/api/push/subscribe', {
          endpoint: sub.endpoint,
          keys: {
            p256dh: subJson.keys?.['p256dh'] ?? '',
            auth: subJson.keys?.['auth'] ?? '',
          },
        }),
      );

      this._subscribed.set(true);
    } catch (err) {
      console.error('Push subscription failed:', err);
      this._error.set('Failed to enable notifications');
    } finally {
      this._loading.set(false);
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this._supported()) return;
    this._loading.set(true);
    this._error.set(null);

    try {
      const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          // Tell server to remove
          await firstValueFrom(
            this.http.delete('/api/push/subscribe', {
              body: { endpoint: sub.endpoint },
            }),
          );
          await sub.unsubscribe();
        }
      }
      this._subscribed.set(false);
    } catch (err) {
      console.error('Push unsubscribe failed:', err);
      this._error.set('Failed to disable notifications');
    } finally {
      this._loading.set(false);
    }
  }

  async sendTest(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);
    try {
      await firstValueFrom(this.http.post('/api/push/test', {}));
    } catch {
      this._error.set('Failed to send test notification');
    } finally {
      this._loading.set(false);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}
