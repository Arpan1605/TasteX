import { Routes } from '@angular/router';
import { GuestOrderComponent } from './pages/guest-order/guest-order.component';
import { KitchenDashboardComponent } from './pages/kitchen-dashboard/kitchen-dashboard.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'guest/blr-gp-01' },
  { path: 'guest/:hotelCode', component: GuestOrderComponent },
  { path: 'kitchen', component: KitchenDashboardComponent },
  { path: '**', redirectTo: 'guest/blr-gp-01' }
];
