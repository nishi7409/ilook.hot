import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'u/:slug', renderMode: RenderMode.Server },
  { path: '', renderMode: RenderMode.Server },
  { path: 'dashboard', renderMode: RenderMode.Client },
  { path: 'programs', renderMode: RenderMode.Client },
  { path: 'calories', renderMode: RenderMode.Client },
  { path: 'workouts', renderMode: RenderMode.Client },
  { path: 'photos', renderMode: RenderMode.Client },
  { path: 'settings', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Server },
];
