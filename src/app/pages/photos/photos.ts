import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowUpTray,
  heroArrowsRightLeft,
  heroCamera,
  heroXMark,
} from '@ng-icons/heroicons/outline';
import { format } from 'date-fns';
import { PhotoService } from '../../services/photo.service';
import type { PhotoCategory, ProgressPhoto } from '../../models/photo.model';

@Component({
  selector: 'app-photos',
  imports: [NgIconComponent, TitleCasePipe],
  providers: [
    provideIcons({ heroCamera, heroArrowUpTray, heroXMark, heroArrowsRightLeft }),
  ],
  templateUrl: './photos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-1 flex-col overflow-hidden min-w-0' },
})
export class Photos {
  protected readonly photoService = inject(PhotoService);

  // Tab state
  protected readonly tabs = [
    { id: 'gallery' as const, label: 'Gallery' },
    { id: 'compare' as const, label: 'Compare' },
  ];
  protected readonly activeTab = signal<'gallery' | 'compare'>('gallery');

  // Upload form state
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly uploadDate = signal(format(new Date(), 'yyyy-MM-dd'));
  protected readonly uploadCategory = signal<PhotoCategory>('front');
  protected readonly uploadBodyweight = signal<number | null>(null);
  protected readonly uploadNotes = signal('');
  protected readonly categories: PhotoCategory[] = ['front', 'side', 'back', 'other'];

  // Lightbox
  protected readonly lightboxPhoto = signal<ProgressPhoto | null>(null);

  // Comparison
  protected readonly compareCategory = signal<PhotoCategory>('front');
  protected readonly compareDateA = signal('');
  protected readonly compareDateB = signal('');

  protected readonly comparePhotoA = computed(() => {
    const dateA = this.compareDateA();
    const cat = this.compareCategory();
    if (!dateA) return null;
    return this.photoService.photos().find((p) => p.date === dateA && p.category === cat) ?? null;
  });

  protected readonly comparePhotoB = computed(() => {
    const dateB = this.compareDateB();
    const cat = this.compareCategory();
    if (!dateB) return null;
    return this.photoService.photos().find((p) => p.date === dateB && p.category === cat) ?? null;
  });

  // ── Upload actions ────────────────────────────────────────────────────────

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.selectedFile.set(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = () => this.previewUrl.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  upload(): void {
    const file = this.selectedFile();
    if (!file) return;

    this.photoService.uploadPhoto(
      file,
      this.uploadDate(),
      this.uploadCategory(),
      this.uploadBodyweight() ?? undefined,
      this.uploadNotes() || undefined,
    );

    // Reset form
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.uploadNotes.set('');
    this.uploadBodyweight.set(null);
  }

  // ── Lightbox ──────────────────────────────────────────────────────────────

  openLightbox(photo: ProgressPhoto): void {
    this.lightboxPhoto.set(photo);
  }

  closeLightbox(): void {
    this.lightboxPhoto.set(null);
  }

  deletePhoto(id: string): void {
    this.photoService.deletePhoto(id);
    this.closeLightbox();
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  asInputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  asNumberValue(event: Event): number | null {
    const val = (event.target as HTMLInputElement).value;
    return val ? Number(val) : null;
  }

  asSelectValue(event: Event): PhotoCategory {
    return (event.target as HTMLSelectElement).value as PhotoCategory;
  }
}
