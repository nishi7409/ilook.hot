import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'dashboard', renderMode: RenderMode.Client },
  { path: 'programs', renderMode: RenderMode.Client },
  { path: 'calories', renderMode: RenderMode.Client },
  { path: 'workouts', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
