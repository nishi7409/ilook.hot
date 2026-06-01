import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then((m) => m.Landing),
    pathMatch: 'full',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./components/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'programs',
        loadComponent: () => import('./pages/programs/programs').then((m) => m.Programs),
      },
      {
        path: 'calories',
        loadComponent: () => import('./pages/calories/calories').then((m) => m.Calories),
      },
      {
        path: 'workouts',
        loadComponent: () => import('./pages/workouts/workouts').then((m) => m.Workouts),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings').then((m) => m.Settings),
      },
    ],
  },
];
