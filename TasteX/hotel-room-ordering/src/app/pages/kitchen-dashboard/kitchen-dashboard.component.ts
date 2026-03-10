import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { ITEMS } from '../../data/dummy-data';
import { MockStoreService } from '../../services/mock-store.service';
import { KitchenApiService } from '../../services/kitchen-api.service';
import { OrderStatus } from '../../models/domain.models';

type QueueFilter = 'Active Orders' | 'New' | OrderStatus;
type DashboardRow = ReturnType<MockStoreService['getDashboardOrders']>[number];
type ToastItem = { id: number; message: string };
type MenuInventoryItem = { hotelId: number; itemId: number; name: string; isVeg: boolean; isActive: boolean; baseInventory: number; availableKitchenIds: number[] };

@Component({
  selector: 'app-kitchen-dashboard',
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule],
  templateUrl: './kitchen-dashboard.component.html',
  styleUrl: './kitchen-dashboard.component.scss'
})
export class KitchenDashboardComponent implements OnDestroy {
  private readonly store = inject(MockStoreService);
  private readonly kitchenApi = inject(KitchenApiService);
  private readonly knownOrderIds = new Set<number>();
  private readonly pulseTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly itemById = new Map(ITEMS.map((item) => [item.id, item] as const));
  private readonly menuStorageKey = 'tx_admin_menu_v1';
  private readonly hotelMenuStorageKey = 'tx_admin_hotel_menus_v1';
    private readonly kitchenSessionKey = 'tx_kitchen_session_v1';
  private readonly nowTick = signal(Date.now());
  private readonly menuItems = signal<MenuInventoryItem[]>(this.loadMenuItems());
  private readonly refreshTimer: ReturnType<typeof setInterval> | null;
  private toastId = 0;
  private initialized = false;

  selectedKitchenId = signal<number | null>(this.loadKitchenSession());
  kitchenLoginUsername = signal('');
  kitchenLoginPassword = signal('');
  selectedHotelId = signal<number | null>(null);
  selectedQueue = signal<QueueFilter>('Active Orders');
  unreadNew = signal(0);
  highlightNew = signal(false);
  notificationToasts = signal<ToastItem[]>([]);
  expandedOrderId = signal<number | null>(null);

  rejectDialogOrderId = signal<number | null>(null);
  rejectionReason = signal('');
  rejectionReasonError = signal('');
  actionMessage = signal('');
  loginError = signal('');

  readonly hotels = this.store.hotels;
  readonly kitchens = this.store.kitchens;
  readonly queueOptions: QueueFilter[] = ['Active Orders', 'New', 'Accepted', 'Preparing', 'Ready', 'Delivered', 'Rejected'];

  readonly kitchenHotels = computed(() => {
    const kitchenId = this.selectedKitchenId();
    return kitchenId ? this.store.hotels.filter((hotel) => hotel.kitchenId === kitchenId) : [];
  });

  readonly scopedRows = computed(() => {
    const kitchenId = this.selectedKitchenId();
    if (!kitchenId) {
      return [] as DashboardRow[];
    }

    return this.store.getDashboardOrders().filter((row) => row.kitchenId === kitchenId);
  });

  readonly rows = computed(() => {
    const hotelId = this.selectedHotelId();
    const kitchenRows = this.scopedRows();
    return hotelId ? kitchenRows.filter((row) => row.hotelId === hotelId) : kitchenRows;
  });

  readonly inventoryRows = computed(() => {
    this.nowTick();
    const kitchenId = this.selectedKitchenId();
    if (!kitchenId) {
      return [] as Array<{ itemId: number; name: string; isVeg: boolean; baseInventory: number; available: number }>;
    }

    const kitchenHotelIds = this.kitchenHotels().map((hotel) => hotel.id);
    const targetHotelIds = this.selectedHotelId() ? [this.selectedHotelId() as number] : kitchenHotelIds;
    const reservedByKey = new Map<string, number>();

    this.store.getDashboardOrders()
      .filter((row) => targetHotelIds.includes(row.hotelId) && row.status !== 'Rejected')
      .forEach((row) => {
        row.lines.forEach((line) => {
          const key = `${row.hotelId}:${line.itemId}`;
          reservedByKey.set(key, (reservedByKey.get(key) ?? 0) + line.quantity);
        });
      });

    const aggregate = new Map<number, { itemId: number; name: string; isVeg: boolean; baseInventory: number; available: number }>();

    this.menuItems()
      .filter((item) => targetHotelIds.includes(item.hotelId) && item.isActive && item.availableKitchenIds.includes(kitchenId))
      .forEach((item) => {
        const reserved = reservedByKey.get(`${item.hotelId}:${item.itemId}`) ?? 0;
        const current = aggregate.get(item.itemId) ?? { itemId: item.itemId, name: item.name, isVeg: item.isVeg, baseInventory: 0, available: 0 };
        current.baseInventory += item.baseInventory;
        current.available += Math.max(0, item.baseInventory - reserved);
        aggregate.set(item.itemId, current);
      });

    return Array.from(aggregate.values()).sort((a, b) => a.name.localeCompare(b.name));
  });

  readonly stats = computed(() => {
    this.nowTick();
    const source = this.rows();
    const newCount = source.filter((row) => this.isNewOrder(row)).length;
    const activeCount = source.filter((row) => row.status !== 'Delivered' && row.status !== 'Rejected').length;
    const doneCount = source.filter((row) => row.status === 'Delivered').length;
    const avgTime = source.length > 0
      ? Math.round(source.reduce((sum, row) => sum + this.elapsedMinutes(row.createdAt), 0) / source.length)
      : 0;

    return { newCount, activeCount, doneCount, avgTime };
  });

  readonly chipNewCount = computed(() => this.unreadNew() || this.stats().newCount);

  readonly kitchenTitle = computed(() => {
    const kitchenId = this.selectedKitchenId();
    if (!kitchenId) {
      return 'Kitchen Dashboard';
    }

    return this.store.kitchens.find((entry) => entry.id === kitchenId)?.name ?? 'Kitchen Dashboard';
  });

  readonly kitchenSubtitle = computed(() => {
    const kitchenId = this.selectedKitchenId();
    if (!kitchenId) {
      return 'Select a kitchen to continue';
    }

    const kitchen = this.store.kitchens.find((entry) => entry.id === kitchenId);
    const cityName = this.store.cities.find((entry) => entry.id === kitchen?.cityId)?.name ?? 'Unknown City';
    const hotelCount = this.kitchenHotels().length;
    return `${cityName} ï¿½ ${hotelCount} hotel${hotelCount === 1 ? '' : 's'} mapped`;
  });

  readonly filteredRows = computed(() => {
    this.nowTick();
    const queue = this.selectedQueue();
    const source = this.rows();

    if (queue === 'Active Orders') {
      return source.filter((row) => row.status !== 'Delivered' && row.status !== 'Rejected');
    }

    if (queue === 'New') {
      return source.filter((row) => this.isNewOrder(row));
    }

    return source.filter((row) => row.status === queue);
  });

  constructor() {
    this.refreshTimer = typeof window !== 'undefined'
      ? setInterval(() => this.nowTick.set(Date.now()), 30000)
      : null;

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === this.menuStorageKey || event.key === this.hotelMenuStorageKey) {
          this.menuItems.set(this.loadMenuItems());
          return;
        }
        if (event.key === this.kitchenSessionKey) {
          this.selectedKitchenId.set(this.loadKitchenSession());
        }
      });
    }

    effect(() => {
      const hotels = this.kitchenHotels();
      const selectedHotelId = this.selectedHotelId();

      if (selectedHotelId && !hotels.some((hotel) => hotel.id === selectedHotelId)) {
        this.selectedHotelId.set(null);
      }
    });

    effect(() => {
      const kitchenId = this.selectedKitchenId();
      if (typeof window === 'undefined') {
        return;
      }

      if (kitchenId) {
        localStorage.setItem(this.kitchenSessionKey, String(kitchenId));
      } else {
        localStorage.removeItem(this.kitchenSessionKey);
      }
    });

    effect(() => {
      const rows = this.scopedRows();
      const kitchenId = this.selectedKitchenId();

      if (!kitchenId) {
        this.knownOrderIds.clear();
        this.initialized = false;
        this.notificationToasts.set([]);
        this.unreadNew.set(0);
        this.highlightNew.set(false);
        return;
      }

      const scopedIds = new Set(rows.map((row) => row.id));
      Array.from(this.knownOrderIds).forEach((id) => {
        if (!scopedIds.has(id)) {
          this.knownOrderIds.delete(id);
        }
      });

      if (!this.initialized) {
        rows.forEach((row) => this.knownOrderIds.add(row.id));
        this.initialized = true;
        return;
      }

      const incoming = rows.filter((row) => !this.knownOrderIds.has(row.id));
      if (incoming.length === 0) {
        return;
      }

      incoming.forEach((row) => this.knownOrderIds.add(row.id));
      this.unreadNew.update((count) => count + incoming.length);
      this.highlightNew.set(true);

      const pulseTimer = setTimeout(() => this.highlightNew.set(false), 4500);
      this.pulseTimers.add(pulseTimer);

      incoming.forEach((row) => this.pushToast(row));
      this.playNotificationSound();
    });
  }

  ngOnDestroy(): void {
    this.pulseTimers.forEach((timer) => clearTimeout(timer));
    this.pulseTimers.clear();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  async loginToKitchen(): Promise<void> {
    const username = this.kitchenLoginUsername().trim().toLowerCase();
    const password = this.kitchenLoginPassword().trim();

    if (!username || !password) {
      this.loginError.set('Username and password are required.');
      return;
    }

    try {
      const response = await firstValueFrom(this.kitchenApi.login({ username, password }));
      if (!response.success || !response.data?.kitchenId) {
        this.loginError.set('Invalid kitchen credentials. Use the credentials issued from Admin > Kitchens.');
        return;
      }

      this.selectedKitchenId.set(response.data.kitchenId);
      this.selectedHotelId.set(null);
      this.selectedQueue.set('Active Orders');
      this.loginError.set('');
      this.notificationToasts.set([]);
      this.unreadNew.set(0);
      this.highlightNew.set(false);
      this.knownOrderIds.clear();
      this.initialized = false;
    } catch {
      this.loginError.set('Kitchen login service is unavailable. Check the backend API and try again.');
    }
  }

  logoutKitchen(): void {
    this.selectedKitchenId.set(null);
    this.kitchenLoginUsername.set('');
    this.kitchenLoginPassword.set('');
    this.selectedHotelId.set(null);
    this.selectedQueue.set('Active Orders');
    this.notificationToasts.set([]);
    this.unreadNew.set(0);
    this.highlightNew.set(false);
    this.knownOrderIds.clear();
    this.initialized = false;
  }

  setHotelFilter(value: string): void {
    if (!value) {
      this.selectedHotelId.set(null);
      return;
    }
    this.selectedHotelId.set(Number(value));
  }

  setQueue(value: QueueFilter): void {
    this.selectedQueue.set(value);
  }

  openNewNotifications(): void {
    this.selectedQueue.set('New');
    this.unreadNew.set(0);
    this.highlightNew.set(false);
  }

  closeNotification(id: number): void {
    this.notificationToasts.update((items) => items.filter((item) => item.id !== id));
  }

  clearNotifications(): void {
    this.notificationToasts.set([]);
    this.highlightNew.set(false);
  }

  toggleOrder(orderId: number): void {
    this.expandedOrderId.set(this.expandedOrderId() === orderId ? null : orderId);
  }

  isExpanded(orderId: number): boolean {
    return this.expandedOrderId() === orderId;
  }

  acceptOrder(orderId: number): void {
    this.store.updateOrderStatus(orderId, 'Accepted');
  }

  startPreparing(orderId: number): void {
    this.store.updateOrderStatus(orderId, 'Preparing');
  }

  markReady(orderId: number): void {
    this.store.updateOrderStatus(orderId, 'Ready');
  }

  markDelivered(orderId: number): void {
    this.store.updateOrderStatus(orderId, 'Delivered');
    this.selectedQueue.set('Delivered');
    this.expandedOrderId.set(orderId);
  }

  openRejectDialog(orderId: number): void {
    this.rejectDialogOrderId.set(orderId);
    this.rejectionReason.set('');
    this.rejectionReasonError.set('');
  }

  closeRejectDialog(): void {
    this.rejectDialogOrderId.set(null);
    this.rejectionReason.set('');
    this.rejectionReasonError.set('');
  }

  submitReject(): void {
    const orderId = this.rejectDialogOrderId();
    const reason = this.rejectionReason().trim();

    if (!orderId) {
      return;
    }

    if (!reason) {
      this.rejectionReasonError.set('Reason for rejection is required.');
      return;
    }

    const result = this.store.rejectOrder(orderId, reason);
    if (result.success) {
      this.actionMessage.set(result.message);
      this.expandedOrderId.set(null);
      const clearTimer = setTimeout(() => this.actionMessage.set(''), 5000);
      this.pulseTimers.add(clearTimer);
    }

    this.closeRejectDialog();
  }

  showAcceptedState(row: { status: OrderStatus; createdAt: string; updatedAt: string }): boolean {
    return this.statusOf(row) === 'accepted' && !this.isNewOrder(row);
  }

  showPreparingState(row: { status: OrderStatus }): boolean {
    return this.statusOf(row) === 'preparing';
  }

  showReadyState(row: { status: OrderStatus }): boolean {
    return this.statusOf(row) === 'ready';
  }

  shouldShowAcceptedTime(row: { status: OrderStatus; acceptedAt?: string }): boolean {
    const status = this.statusOf(row);
    return Boolean(row.acceptedAt) || status === 'preparing' || status === 'ready' || status === 'delivered';
  }

  itemName(itemId: number): string {
    return this.itemById.get(itemId)?.name ?? `Item #${itemId}`;
  }

  itemIsVeg(itemId: number): boolean {
    return this.itemById.get(itemId)?.isVeg ?? true;
  }

  placedTime(iso?: string): string {
    if (!iso) {
      return '-';
    }
    return new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
      .format(new Date(iso))
      .toLowerCase();
  }

  elapsedMinutes(iso: string): number {
    this.nowTick();
    return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  }

  isNewOrder(row: { status: OrderStatus; createdAt: string; updatedAt: string }): boolean {
    return this.statusOf(row) === 'accepted' && this.elapsedMinutes(row.createdAt) <= 10 && row.createdAt === row.updatedAt;
  }

  statusLabel(row: { status: OrderStatus; createdAt: string; updatedAt: string }): string {
    return this.isNewOrder(row) ? 'New Order' : row.status;
  }

  statusClass(row: { status: OrderStatus; createdAt: string; updatedAt: string }): string {
    const status = this.statusOf(row);
    if (this.isNewOrder(row)) {
      return 'new';
    }
    if (status === 'accepted') {
      return 'accepted';
    }
    if (status === 'preparing') {
      return 'preparing';
    }
    if (status === 'ready') {
      return 'ready';
    }
    if (status === 'rejected') {
      return 'rejected';
    }
    return 'delivered';
  }

  iconClass(row: { status: OrderStatus; createdAt: string; updatedAt: string }): string {
    const status = this.statusOf(row);
    if (this.isNewOrder(row)) {
      return 'new';
    }
    if (status === 'preparing') {
      return 'preparing';
    }
    if (status === 'ready') {
      return 'ready';
    }
    if (status === 'rejected') {
      return 'rejected';
    }
    if (status === 'delivered') {
      return 'delivered';
    }
    return 'accepted';
  }

  deliveredTotalMinutes(createdAt: string, deliveredAt?: string): number {
    const deliveredTime = deliveredAt ? new Date(deliveredAt).getTime() : Date.now();
    return Math.max(1, Math.round((deliveredTime - new Date(createdAt).getTime()) / 60000));
  }

  timeAgo(mins: number): string {
    if (mins < 60) {
      return `${mins}m ago`;
    }

    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (m === 0) {
      return `${h}h ago`;
    }
    return `${h}h ${m}m ago`;
  }

  private statusOf(row: { status: string }): string {
    return (row.status || '').trim().toLowerCase();
  }

  private pushToast(row: DashboardRow): void {
    const room = row.roomNumber ? ' • Room ' + row.roomNumber : '';
    const id = ++this.toastId;
    this.notificationToasts.update((items) => [{ id, message: row.orderNo + ' • ' + row.hotelName + room }, ...items].slice(0, 8));
  }

  private loadKitchenSession(): number | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(this.kitchenSessionKey);
    const kitchenId = Number(raw);
    return Number.isFinite(kitchenId) && kitchenId > 0 ? kitchenId : null;
  }

  private loadMenuItems(): MenuInventoryItem[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const hotelRaw = localStorage.getItem(this.hotelMenuStorageKey);
      if (hotelRaw) {
        const parsed = JSON.parse(hotelRaw);
        if (parsed && typeof parsed === 'object') {
          return Object.entries(parsed).flatMap(([hotelId, categories]) => Array.isArray(categories)
            ? (categories as Array<{ items?: Array<{ itemId: number; name: string; isVeg: boolean; isActive: boolean; baseInventory?: number; availableKitchenIds?: number[] }> }>).flatMap((category) => Array.isArray(category.items)
                ? category.items.map((item) => ({
                    hotelId: Number(hotelId),
                    itemId: item.itemId,
                    name: item.name,
                    isVeg: item.isVeg,
                    isActive: item.isActive,
                    baseInventory: item.baseInventory ?? 0,
                    availableKitchenIds: item.availableKitchenIds ?? []
                  }))
                : [])
            : []);
        }
      }

      const raw = localStorage.getItem(this.menuStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.flatMap((category) => Array.isArray(category.items)
        ? category.items.map((item: { itemId: number; name: string; isVeg: boolean; isActive: boolean; baseInventory?: number; availableKitchenIds?: number[] }) => ({
            hotelId: 0,
            itemId: item.itemId,
            name: item.name,
            isVeg: item.isVeg,
            isActive: item.isActive,
            baseInventory: item.baseInventory ?? 0,
            availableKitchenIds: item.availableKitchenIds ?? []
          }))
        : []);
    } catch {
      return [];
    }
  }

  private playNotificationSound(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        return;
      }

      const ctx = new AudioCtx();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);

      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.26);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.onended = () => {
        void ctx.close();
      };

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.27);
    } catch {
      // Browser may block sound until user interaction.
    }
  }

}









