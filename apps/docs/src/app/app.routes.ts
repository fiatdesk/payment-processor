import { Route } from '@angular/router';
import { Docs } from './pages/docs/docs';

export const appRoutes: Route[] = [
  { path: 'docs', pathMatch: 'full', redirectTo: '' },
  { path: 'docs/:section/:subsection', redirectTo: '/:section/:subsection' },
  { path: 'docs/:section', redirectTo: '/:section' },
  { path: '', pathMatch: 'full', component: Docs },
  { path: ':section/:subsection', component: Docs },
  { path: ':section', component: Docs },
];
