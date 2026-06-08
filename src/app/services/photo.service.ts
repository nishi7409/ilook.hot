import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { PhotoCategory, PhotoTimeline, ProgressPhoto } from '../models/photo.model';

@Injectable({ providedIn: 'root' })
export class PhotoService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly _photos = signal<ProgressPhoto[]>([]);
  private readonly _timeline = signal<PhotoTimeline[]>([]);
  private readonly _loading = signal(false);

  readonly photos = this._photos.asReadonly();
  readonly timeline = this._timeline.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly photosByDate = computed(() => {
    const grouped = new Map<string, ProgressPhoto[]>();
    for (const photo of this._photos()) {
      const existing = grouped.get(photo.date) ?? [];
      existing.push(photo);
      grouped.set(photo.date, existing);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, photos]) => ({ date, photos }));
  });

  readonly uniqueDates = computed(() =>
    [...new Set(this._photos().map((p) => p.date))].sort((a, b) => b.localeCompare(a)),
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadPhotos();
    }
  }

  loadPhotos(startDate?: string, endDate?: string): void {
    this._loading.set(true);
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate) params = params.set('endDate', endDate);

    this.http.get<ProgressPhoto[]>('/api/photos', { params }).subscribe({
      next: (photos) => {
        this._photos.set(photos);
        this._loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load photos', err);
        this._loading.set(false);
      },
    });
  }

  uploadPhoto(
    file: File,
    date: string,
    category: PhotoCategory,
    bodyweight?: number,
    notes?: string,
  ): void {
    this._loading.set(true);
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('date', date);
    formData.append('category', category);
    if (bodyweight != null) formData.append('bodyweight', String(bodyweight));
    if (notes) formData.append('notes', notes);

    this.http.post<ProgressPhoto>('/api/photos', formData).subscribe({
      next: (photo) => {
        this._photos.update((photos) => [photo, ...photos]);
        this._loading.set(false);
      },
      error: (err) => {
        console.error('Failed to upload photo', err);
        this._loading.set(false);
      },
    });
  }

  deletePhoto(id: string): void {
    this._photos.update((photos) => photos.filter((p) => p.id !== id));
    this.http.delete(`/api/photos/${id}`).subscribe({
      error: (err) => {
        console.error('Failed to delete photo', err);
        this.loadPhotos();
      },
    });
  }

  loadTimeline(): void {
    this._loading.set(true);
    this.http.get<PhotoTimeline[]>('/api/photos/timeline').subscribe({
      next: (timeline) => {
        this._timeline.set(timeline);
        this._loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load timeline', err);
        this._loading.set(false);
      },
    });
  }
}
