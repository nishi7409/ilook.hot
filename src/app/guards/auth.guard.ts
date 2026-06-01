import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, map, take } from 'rxjs';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Wait until the initial /api/auth/me check resolves before deciding
  return toObservable(auth.loading).pipe(
    filter((loading) => !loading),
    take(1),
    map(() => {
      if (auth.user()) return true;
      return router.createUrlTree(['/'], { queryParams: { auth: 'signin' } });
    }),
  );
};
