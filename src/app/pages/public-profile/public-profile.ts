import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

interface ProfileStats {
  totalWorkouts: number;
  currentStreak: number;
  prs: { exercise: string; estimated1RM: number }[];
}

interface ProfilePhoto {
  id: string;
  date: string;
  photoUrl: string;
  category: string;
}

interface ProfileProgram {
  name: string;
  days: { name: string; isRest: boolean; exerciseCount: number }[];
}

interface ProfileNutrition {
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
}

interface PublicProfileData {
  displayName: string;
  memberSince: string;
  showStats: boolean;
  showPhotos: boolean;
  showProgram: boolean;
  showNutrition: boolean;
  stats?: ProfileStats;
  photos?: ProfilePhoto[];
  program?: ProfileProgram;
  nutrition?: ProfileNutrition;
}

@Component({
  selector: 'app-public-profile',
  templateUrl: './public-profile.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicProfile implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  readonly profile = signal<PublicProfileData | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  // Alias for template @if ... as binding
  readonly profileData = this.profile;
  readonly statsData = computed(() => this.profile()?.stats ?? null);
  readonly programData = computed(() => this.profile()?.program ?? null);
  readonly nutritionData = computed(() => this.profile()?.nutrition ?? null);
  readonly photosData = computed(() => this.profile()?.photos ?? null);

  readonly initials = computed(() => {
    const name = this.profile()?.displayName ?? '';
    return name
      .split(/[\s-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('');
  });

  readonly memberSince = computed(() => {
    const date = this.profile()?.memberSince;
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }

    const slug = this.route.snapshot.paramMap.get('slug');
    if (!slug) {
      this.loading.set(false);
      this.error.set(true);
      return;
    }

    this.http.get<PublicProfileData>(`/api/u/${slug}`).subscribe({
      next: (data) => {
        this.profile.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
