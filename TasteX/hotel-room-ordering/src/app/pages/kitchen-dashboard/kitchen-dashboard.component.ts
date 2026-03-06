import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MockStoreService } from '../../services/mock-store.service';
import { OrderStatus } from '../../models/domain.models';

@Component({
  selector: 'app-kitchen-dashboard',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    ButtonModule,
    SelectModule,
    TableModule,
    TagModule,
    SelectButtonModule
  ],
  templateUrl: './kitchen-dashboard.component.html',
  styleUrl: './kitchen-dashboard.component.scss'
})
export class KitchenDashboardComponent {
  private readonly store = inject(MockStoreService);

  selectedHotelId = signal<number | null>(null);
  readonly hotels = this.store.hotels.map((hotel) => ({ label: hotel.name, value: hotel.id }));
  readonly statusOptions = [
    { label: 'Accepted', value: 'Accepted' },
    { label: 'Preparing', value: 'Preparing' },
    { label: 'Ready', value: 'Ready' },
    { label: 'Delivered', value: 'Delivered' }
  ];

  readonly rows = computed(() => this.store.getDashboardOrders(this.selectedHotelId() ?? undefined));

  setHotelFilter(value: number | null): void {
    this.selectedHotelId.set(value);
  }

  updateStatus(orderId: number, status: OrderStatus): void {
    this.store.updateOrderStatus(orderId, status);
  }

  statusSeverity(status: OrderStatus): 'info' | 'warn' | 'success' | 'contrast' {
    if (status === 'Accepted') {
      return 'info';
    }

    if (status === 'Preparing') {
      return 'warn';
    }

    if (status === 'Ready') {
      return 'contrast';
    }

    return 'success';
  }
}
