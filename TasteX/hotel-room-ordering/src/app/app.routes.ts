import { Routes } from '@angular/router';
import { GuestOrderComponent } from './pages/guest-order/guest-order.component';
import { KitchenDashboardComponent } from './pages/kitchen-dashboard/kitchen-dashboard.component';
import { AdminLoginComponent } from './pages/admin-login/admin-login.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'guest' },
  { path: 'guest', component: GuestOrderComponent },
  { path: 'guest/:kitchenCode', component: GuestOrderComponent },
  { path: 'kitchen', component: KitchenDashboardComponent },
  { path: 'admin', pathMatch: 'full', redirectTo: 'admin/login' },
  { path: 'admin/login', component: AdminLoginComponent },
  { path: 'admin/dashboard', component: AdminDashboardComponent },
  { path: '**', redirectTo: 'guest' }
];
