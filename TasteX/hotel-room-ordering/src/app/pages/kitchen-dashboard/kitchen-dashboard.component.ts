import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { OrderStatus } from '../../models/domain.models';
import { AdminApiService, AdminHotelDto, AdminMenuCategoryDto } from '../../services/admin-api.service';
import {
  KitchenApiService,
  KitchenOrderDto,
  KitchenOrdersResponse,
  UpdateOrderStatusRequest
} from '../../services/kitchen-api.service';

type QueueFilter = 'Active Orders' | 'New' | OrderStatus;
type ToastItem = { id: number; message: string };
type MenuInventoryItem = {
  hotelId: number;
  itemId: number;
  name: string;
  isVeg: boolean;
  isActive: boolean;
  baseInventory: number;
  availableKitchenIds: number[];
};

type DashboardLine = {
  itemId: number;
  itemName: string;
  isVeg: boolean;
  quantity: number;
  unitPrice: number;
};

type DashboardRow = {
  id: number;
  orderNo: string;
  hotelId: number;
  hotelName: string;
  kitchenId: number;
  mobile: string;
  roomNumber?: string;
  lines: DashboardLine[];
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  preparingStartedAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
};

type KitchenSessionState = {
  kitchenId: number;
  kitchenName: string;
  cityName: string;
  loginUsername: string;
};

@Component({
  selector: 'app-kitchen-dashboard',
  imports: [CommonModule, FormsModule, RouterLink, ButtonModule],
  templateUrl: './kitchen-dashboard.component.html',
  styleUrl: './kitchen-dashboard.component.scss'
})
export class KitchenDashboardComponent implements OnDestroy {
  private readonly adminApi = inject(AdminApiService);
  private readonly kitchenApi = inject(KitchenApiService);
  private readonly knownOrderIds = new Set<number>();
  private readonly pulseTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly menuStorageKey = 'tx_admin_menu_v1';
  private readonly hotelMenuStorageKey = 'tx_admin_hotel_menus_v1';
  private readonly kitchenSessionKey = 'tx_kitchen_session_v1';
  private readonly printedKotStorageKey = 'tx_kitchen_printed_kot_v1';
  private readonly nowTick = signal(Date.now());
  private readonly menuItems = signal<MenuInventoryItem[]>(this.loadMenuItems());
  private readonly allHotels = signal<AdminHotelDto[]>([]);
  private readonly backendOrders = signal<DashboardRow[]>([]);
  private readonly hotelMenusByHotelId = signal<Record<number, AdminMenuCategoryDto[]>>({});
  private readonly printedKotByOrderId = signal<Record<number, string>>(this.loadPrintedKotMap());
  private readonly refreshTimer: ReturnType<typeof setInterval> | null;
  private readonly activeSession = signal<KitchenSessionState | null>(this.loadKitchenSession());
  private toastId = 0;
  private initialized = false;

  selectedKitchenId = signal<number | null>(this.activeSession()?.kitchenId ?? null);
  kitchenLoginUsername = signal(this.activeSession()?.loginUsername ?? '');
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
  autoPrintKot = signal(true);
  showBillingPanel = signal(true);
  showInventoryPanel = signal(true);

  readonly queueOptions: QueueFilter[] = ['Active Orders', 'New', 'Accepted', 'Preparing', 'Ready', 'Delivered', 'Rejected'];

  readonly kitchenHotels = computed(() => {
    const kitchenId = this.selectedKitchenId();
    return kitchenId ? this.allHotels().filter((hotel) => hotel.kitchenId === kitchenId) : [];
  });

  readonly scopedRows = computed(() => {
    const kitchenId = this.selectedKitchenId();
    return kitchenId ? this.backendOrders().filter((row) => row.kitchenId === kitchenId) : [];
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

    const kitchenHotelIds = this.kitchenHotels().map((hotel) => hotel.hotelId);
    const targetHotelIds = this.selectedHotelId() ? [this.selectedHotelId() as number] : kitchenHotelIds;
    const reservedByKey = new Map<string, number>();

    this.rows()
      .filter((row) => targetHotelIds.includes(row.hotelId) && row.status !== 'Rejected')
      .forEach((row) => {
        row.lines.forEach((line) => {
          const key = `${row.hotelId}:${line.itemId}`;
          reservedByKey.set(key, (reservedByKey.get(key) ?? 0) + line.quantity);
        });
      });

    const aggregate = new Map<number, { itemId: number; name: string; isVeg: boolean; baseInventory: number; available: number }>();
    const apiMenus = this.hotelMenusByHotelId();
    const hasApiMenus = Object.keys(apiMenus).length > 0;

    if (hasApiMenus) {
      targetHotelIds.forEach((hotelId) => {
        const categories = apiMenus[hotelId] ?? [];
        categories.forEach((category) => {
          category.items.forEach((item) => {
            if (!item.isActive || !item.availableKitchenIds.includes(kitchenId)) {
              return;
            }

            const baseInventory = Math.max(0, Number(item.inventoryQuantity ?? 0));
            const reserved = reservedByKey.get(`${hotelId}:${item.itemId}`) ?? 0;
            const current = aggregate.get(item.itemId) ?? {
              itemId: item.itemId,
              name: item.name,
              isVeg: item.isVeg,
              baseInventory: 0,
              available: 0
            };

            current.baseInventory += baseInventory;
            current.available += Math.max(0, baseInventory - reserved);
            aggregate.set(item.itemId, current);
          });
        });
      });
    } else {
      this.menuItems()
        .filter((item) => targetHotelIds.includes(item.hotelId) && item.isActive && item.availableKitchenIds.includes(kitchenId))
        .forEach((item) => {
          const reserved = reservedByKey.get(`${item.hotelId}:${item.itemId}`) ?? 0;
          const current = aggregate.get(item.itemId) ?? {
            itemId: item.itemId,
            name: item.name,
            isVeg: item.isVeg,
            baseInventory: 0,
            available: 0
          };

          current.baseInventory += item.baseInventory;
          current.available += Math.max(0, item.baseInventory - reserved);
          aggregate.set(item.itemId, current);
        });
    }

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
    const session = this.activeSession();
    return session?.kitchenName?.trim() || 'Kitchen Dashboard';
  });

  readonly kitchenSubtitle = computed(() => {
    const kitchenId = this.selectedKitchenId();
    if (!kitchenId) {
      return 'Select a kitchen to continue';
    }

    const session = this.activeSession();
    const fallbackCity = this.kitchenHotels()[0]?.cityName?.trim();
    const cityName = session?.cityName?.trim() || fallbackCity || 'Unknown City';
    const hotelCount = this.kitchenHotels().length;

    return cityName + ' - ' + hotelCount + ' hotel' + (hotelCount === 1 ? '' : 's') + ' mapped';
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

  readonly kotQueueRows = computed(() => this.rows().filter((row) => row.status !== 'Delivered' && row.status !== 'Rejected'));

  constructor() {
    this.refreshTimer = typeof window !== 'undefined'
      ? setInterval(() => {
          this.nowTick.set(Date.now());
          void this.refreshDashboardData();
        }, 30000)
      : null;

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === this.menuStorageKey || event.key === this.hotelMenuStorageKey) {
          this.menuItems.set(this.loadMenuItems());
        }
      });
    }

    effect(() => {
      const hotels = this.kitchenHotels();
      const selectedHotelId = this.selectedHotelId();

      if (selectedHotelId && !hotels.some((hotel) => hotel.hotelId === selectedHotelId)) {
        this.selectedHotelId.set(null);
      }
    });

    effect(() => {
      const kitchenId = this.selectedKitchenId();
      const session = this.activeSession();

      if (typeof window === 'undefined') {
        return;
      }

      if (kitchenId && session) {
        localStorage.setItem(this.kitchenSessionKey, JSON.stringify(session));
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
      incoming.forEach((row) => this.tryAutoPrintKot(row));
      this.playNotificationSound();
    });

    if (this.selectedKitchenId()) {
      void this.refreshDashboardData();
    }
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

      this.activeSession.set({
        kitchenId: response.data.kitchenId,
        kitchenName: response.data.kitchenName,
        cityName: response.data.cityName,
        loginUsername: response.data.loginUsername
      });

      this.selectedKitchenId.set(response.data.kitchenId);
      this.selectedHotelId.set(null);
      this.selectedQueue.set('Active Orders');
      this.kitchenLoginUsername.set(response.data.loginUsername || username);
      this.kitchenLoginPassword.set('');
      this.loginError.set('');
      this.notificationToasts.set([]);
      this.unreadNew.set(0);
      this.highlightNew.set(false);
      this.knownOrderIds.clear();
      this.initialized = false;

      await this.refreshDashboardData();
    } catch {
      this.loginError.set('Kitchen login service is unavailable. Check the backend API and try again.');
    }
  }

  logoutKitchen(): void {
    this.activeSession.set(null);
    this.selectedKitchenId.set(null);
    this.kitchenLoginUsername.set('');
    this.kitchenLoginPassword.set('');
    this.selectedHotelId.set(null);
    this.selectedQueue.set('Active Orders');
    this.backendOrders.set([]);
    this.allHotels.set([]);
    this.notificationToasts.set([]);
    this.unreadNew.set(0);
    this.highlightNew.set(false);
    this.knownOrderIds.clear();
    this.initialized = false;
  }

  setHotelFilter(value: string): void {
    if (!value) {
      this.selectedHotelId.set(null);
    } else {
      this.selectedHotelId.set(Number(value));
    }

    void this.loadOrdersFromApi();
    void this.loadHotelMenusFromApi();
  }

  setQueue(value: QueueFilter): void {
    this.selectedQueue.set(value);
  }

  toggleBillingPanel(): void {
    this.showBillingPanel.update((open) => !open);
  }

  toggleInventoryPanel(): void {
    this.showInventoryPanel.update((open) => !open);
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
    void this.updateOrderStatus(orderId, 'Accepted').then((updated) => {
      if (!updated) return;
      this.selectedQueue.set('Accepted');
      this.expandedOrderId.set(orderId);
    });
  }

  startPreparing(orderId: number): void {
    void this.updateOrderStatus(orderId, 'Preparing').then((updated) => {
      if (!updated) return;
      this.selectedQueue.set('Preparing');
      this.expandedOrderId.set(orderId);
    });
  }

  markReady(orderId: number): void {
    void this.updateOrderStatus(orderId, 'Ready').then((updated) => {
      if (!updated) return;
      this.selectedQueue.set('Ready');
      this.expandedOrderId.set(orderId);
    });
  }

  markDelivered(orderId: number): void {
    void this.updateOrderStatus(orderId, 'Delivered').then((updated) => {
      if (!updated) return;
      this.selectedQueue.set('Delivered');
      this.expandedOrderId.set(orderId);
    });
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

    void this.updateOrderStatus(orderId, 'Rejected', reason).then((updated) => {
      if (!updated) return;
      this.actionMessage.set('Order rejected successfully.');
      this.expandedOrderId.set(null);
      const clearTimer = setTimeout(() => this.actionMessage.set(''), 5000);
      this.pulseTimers.add(clearTimer);
      this.closeRejectDialog();
    });
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
    const found = this.backendOrders()
      .flatMap((order) => order.lines)
      .find((line) => line.itemId === itemId)?.itemName;

    return found ?? `Item #${itemId}`;
  }

  itemIsVeg(itemId: number): boolean {
    const found = this.backendOrders()
      .flatMap((order) => order.lines)
      .find((line) => line.itemId === itemId)?.isVeg;

    return found ?? true;
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

  isKotPrinted(orderId: number): boolean {
    return !!this.printedKotByOrderId()[orderId];
  }

  kotPrintedTime(orderId: number): string {
    const value = this.printedKotByOrderId()[orderId];
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  printKot(orderId: number): void {
    const row = this.scopedRows().find((entry) => entry.id === orderId);
    if (!row) {
      this.actionMessage.set('Order not found for KOT printing.');
      return;
    }

    this.printKotForRow(row, false);
  }

  reprintKot(orderId: number): void {
    this.printKot(orderId);
  }
  private statusOf(row: { status: string }): string {
    return (row.status || '').trim().toLowerCase();
  }

  private tryAutoPrintKot(row: DashboardRow): void {
    if (!this.autoPrintKot() || this.isKotPrinted(row.id)) {
      return;
    }

    this.printKotForRow(row, true);
  }
  private pushToast(row: DashboardRow): void {
    const room = row.roomNumber ? ' - Room ' + row.roomNumber : '';
    const id = ++this.toastId;
    this.notificationToasts.update((items) => [{ id, message: row.orderNo + ' - ' + row.hotelName + room }, ...items].slice(0, 8));
  }

  private printKotForRow(row: DashboardRow, automatic: boolean): void {
    if (typeof window === 'undefined') {
      return;
    }

    const popup = window.open('', '_kot_' + row.id, 'width=420,height=680');
    if (!popup) {
      if (!automatic) {
        this.actionMessage.set('Popup blocked. Allow popups to print KOT.');
      }
      return;
    }

    popup.document.open();
    popup.document.write(this.buildKotHtml(row));
    popup.document.close();

    const printedAt = new Date().toISOString();
    this.markKotPrinted(row.id, printedAt);

    if (!automatic) {
      this.actionMessage.set('KOT sent to printer.');
      const clearTimer = setTimeout(() => this.actionMessage.set(''), 3000);
      this.pulseTimers.add(clearTimer);
    }
  }

  private buildKotHtml(row: DashboardRow): string {
    const linesHtml = row.lines.map((line, index) =>
      '<tr><td>' + (index + 1) + '</td><td>' + this.escapeHtml(line.itemName) + '</td><td style="text-align:right;">' + line.quantity + '</td></tr>').join('');

    const createdAt = this.escapeHtml(this.placedTime(row.createdAt).toUpperCase());
    const hotel = this.escapeHtml(row.hotelName);
    const room = this.escapeHtml(row.roomNumber || '-');
    const mobile = this.escapeHtml(row.mobile || '-');
    const orderNo = this.escapeHtml(row.orderNo);

    return '<!doctype html><html><head><meta charset="utf-8" /><title>KOT ' + orderNo + '</title><style>' +
      'body{font-family:Arial,sans-serif;margin:0;padding:12px;color:#111;} .head{text-align:center;border-bottom:1px dashed #555;padding-bottom:8px;margin-bottom:8px;} .head h2{margin:0 0 4px;font-size:18px;} .meta{font-size:12px;line-height:1.5;margin-bottom:8px;} table{width:100%;border-collapse:collapse;font-size:13px;} th,td{border-bottom:1px dashed #bbb;padding:6px 2px;} th{text-align:left;font-size:12px;} .foot{margin-top:10px;border-top:1px dashed #555;padding-top:8px;font-size:12px;text-align:center;}' +
      '</style></head><body><div class="head"><h2>KITCHEN ORDER TICKET</h2><div>' + hotel + '</div></div><div class="meta"><div><strong>Order:</strong> ' + orderNo + '</div><div><strong>Room:</strong> ' + room + '</div><div><strong>Mobile:</strong> ' + mobile + '</div><div><strong>Placed:</strong> ' + createdAt + '</div></div><table><thead><tr><th>#</th><th>Item</th><th style="text-align:right;">Qty</th></tr></thead><tbody>' + linesHtml + '</tbody></table><div class="foot">Chef copy</div><script>window.onload=function(){setTimeout(function(){window.print();setTimeout(function(){window.close();},250);},100);};</script></body></html>';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private markKotPrinted(orderId: number, printedAtIso: string): void {
    const next = { ...this.printedKotByOrderId(), [orderId]: printedAtIso };
    this.printedKotByOrderId.set(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.printedKotStorageKey, JSON.stringify(next));
    }
  }
  private async refreshDashboardData(): Promise<void> {
    await this.loadHotelsFromApi();
    await Promise.all([this.loadOrdersFromApi(), this.loadHotelMenusFromApi()]);

  }
  private async loadHotelsFromApi(): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminApi.getHotels());
      if (!response.success || !Array.isArray(response.data)) {
        return;
      }

      this.allHotels.set(response.data);

      const currentCity = this.activeSession()?.cityName?.trim();
      if (currentCity && currentCity.toLowerCase() !== 'unknown city') {
        return;
      }

      const kitchenId = this.selectedKitchenId();
      if (!kitchenId) {
        return;
      }

      const firstHotel = response.data.find((hotel) => hotel.kitchenId === kitchenId);
      if (!firstHotel) {
        return;
      }

      const session = this.activeSession();
      if (!session) {
        return;
      }

      this.activeSession.set({ ...session, cityName: firstHotel.cityName || session.cityName });
    } catch {
      this.allHotels.set([]);
    }
  }

  private async loadOrdersFromApi(): Promise<void> {
    const kitchenId = this.selectedKitchenId();
    if (!kitchenId) {
      this.backendOrders.set([]);
      return;
    }

    try {
      const response = await firstValueFrom(this.kitchenApi.getOrders({
        kitchenId,
        hotelId: this.selectedHotelId() ?? undefined,
        pageNumber: 1,
        pageSize: 200
      }));

      if (!response.success || !response.data) {
        this.backendOrders.set([]);
        return;
      }

      this.backendOrders.set(this.mapOrdersResponse(response.data, kitchenId));
    } catch {
      this.backendOrders.set([]);
    }
  }


  private async loadHotelMenusFromApi(): Promise<void> {
    const kitchenId = this.selectedKitchenId();
    if (!kitchenId) {
      this.hotelMenusByHotelId.set({});
      return;
    }

    const kitchenHotelIds = this.kitchenHotels().map((hotel) => hotel.hotelId);
    const targetHotelIds = this.selectedHotelId() ? [this.selectedHotelId() as number] : kitchenHotelIds;
    if (targetHotelIds.length === 0) {
      this.hotelMenusByHotelId.set({});
      return;
    }

    const next: Record<number, AdminMenuCategoryDto[]> = {};
    await Promise.all(
      targetHotelIds.map(async (hotelId) => {
        try {
          const response = await firstValueFrom(this.adminApi.getHotelMenu(hotelId));
          next[hotelId] = response.success && Array.isArray(response.data) ? response.data : [];
        } catch {
          next[hotelId] = [];
        }
      })
    );

    this.hotelMenusByHotelId.set(next);
  }
  private mapOrdersResponse(payload: KitchenOrdersResponse, kitchenId: number): DashboardRow[] {
    if (!Array.isArray(payload.orders)) {
      return [];
    }

    return payload.orders.map((order) => this.mapOrderDto(order, kitchenId));
  }

  private mapOrderDto(dto: KitchenOrderDto, kitchenId: number): DashboardRow {
    const status = this.mapOrderStatus(dto.orderStatus);
    const createdAt = dto.createdAtUtc;
    const updatedAt = dto.updatedAtUtc;

    return {
      id: dto.orderId,
      orderNo: dto.orderNumber,
      hotelId: dto.hotelId,
      hotelName: dto.hotelName,
      kitchenId,
      mobile: this.normalizeMobileNumber(dto.mobileNumber, dto.maskedMobileNumber),
      roomNumber: this.normalizeRoomNumber(dto.roomNumber),
      lines: Array.isArray(dto.lines)
        ? dto.lines.map((line) => ({
            itemId: line.itemId,
            itemName: line.itemName,
            isVeg: !!line.isVeg,
            quantity: line.quantity,
            unitPrice: line.unitPrice
          }))
        : [],
      totalAmount: dto.totalAmount,
      paymentMethod: this.mapPaymentMethod(dto.paymentMethod),
      paymentStatus: this.mapPaymentStatus(dto.paymentStatus),
      status,
      createdAt,
      updatedAt,
      acceptedAt: status === 'Accepted' || status === 'Preparing' || status === 'Ready' || status === 'Delivered' ? updatedAt : undefined,
      preparingStartedAt: status === 'Preparing' || status === 'Ready' || status === 'Delivered' ? updatedAt : undefined,
      readyAt: status === 'Ready' || status === 'Delivered' ? updatedAt : undefined,
      deliveredAt: status === 'Delivered' ? updatedAt : undefined,
      rejectedAt: status === 'Rejected' ? updatedAt : undefined
    };
  }

  private mapOrderStatus(status: number | string): OrderStatus {
    if (typeof status === 'string') {
      const normalized = status.trim().toLowerCase();
      if (normalized === 'accepted') return 'Accepted';
      if (normalized === 'preparing') return 'Preparing';
      if (normalized === 'ready') return 'Ready';
      if (normalized === 'delivered') return 'Delivered';
      if (normalized === 'cancelled' || normalized === 'rejected') return 'Rejected';
      return 'Accepted';
    }

    switch (status) {
      case 1: return 'Accepted';
      case 2: return 'Preparing';
      case 3: return 'Ready';
      case 4: return 'Delivered';
      case 5: return 'Rejected';
      default: return 'Accepted';
    }
  }

  private mapPaymentMethod(method: number | string): string {
    if (typeof method === 'string') {
      return method;
    }
    return method === 1 ? 'COD' : String(method);
  }

  private mapPaymentStatus(status: number | string): string {
    if (typeof status === 'string') {
      return status;
    }

    switch (status) {
      case 1: return 'Pending';
      case 2: return 'Paid';
      case 3: return 'Failed';
      case 4: return 'Refunded';
      default: return String(status);
    }
  }

  private toApiOrderStatus(status: OrderStatus): number {
    if (status === 'Accepted') return 1;
    if (status === 'Preparing') return 2;
    if (status === 'Ready') return 3;
    if (status === 'Delivered') return 4;
    return 5;
  }

  private async updateOrderStatus(orderId: number, status: OrderStatus, notes?: string): Promise<boolean> {
    const kitchenId = this.selectedKitchenId();
    if (!kitchenId) {
      this.actionMessage.set('Select a kitchen first.');
      return false;
    }

    const stringRequest: UpdateOrderStatusRequest = {
      orderId,
      newStatus: status,
      updatedBy: this.activeSession()?.loginUsername || this.kitchenTitle(),
      notes
    };

    const numericRequest: UpdateOrderStatusRequest = {
      orderId,
      newStatus: this.toApiOrderStatus(status),
      updatedBy: this.activeSession()?.loginUsername || this.kitchenTitle(),
      notes
    };

    const applySuccess = async (): Promise<boolean> => {
      this.actionMessage.set('Order status updated.');
      const clearTimer = setTimeout(() => this.actionMessage.set(''), 3000);
      this.pulseTimers.add(clearTimer);
      await this.loadOrdersFromApi();
      return true;
    };

    try {
      const response = await firstValueFrom(this.kitchenApi.updateOrderStatus(orderId, stringRequest));
      if (response.success) {
        return await applySuccess();
      }

      const fallback = await firstValueFrom(this.kitchenApi.updateOrderStatus(orderId, numericRequest));
      if (fallback.success) {
        return await applySuccess();
      }

      const apiError = fallback.errors && fallback.errors.length > 0 ? fallback.errors[0] : null;
      this.actionMessage.set(apiError || fallback.message || 'Unable to update order status right now.');
      const clearTimer = setTimeout(() => this.actionMessage.set(''), 4000);
      this.pulseTimers.add(clearTimer);
      return false;
    } catch (error) {
      try {
        const fallback = await firstValueFrom(this.kitchenApi.updateOrderStatus(orderId, numericRequest));
        if (fallback.success) {
          return await applySuccess();
        }

        const apiError = fallback.errors && fallback.errors.length > 0 ? fallback.errors[0] : null;
        this.actionMessage.set(apiError || fallback.message || 'Unable to update order status right now.');
        const clearTimer = setTimeout(() => this.actionMessage.set(''), 4000);
        this.pulseTimers.add(clearTimer);
        return false;
      } catch (fallbackError) {
        const httpError = fallbackError instanceof HttpErrorResponse
          ? fallbackError
          : (error instanceof HttpErrorResponse ? error : null);

        this.actionMessage.set(httpError?.error?.error?.message || httpError?.error?.message || 'Status update failed. Check API connection.');
        const clearTimer = setTimeout(() => this.actionMessage.set(''), 4000);
        this.pulseTimers.add(clearTimer);
        return false;
      }
    }
  }
  private async updatePaymentStatus(orderId: number, status: string, notes?: string): Promise<boolean> {
    const kitchenId = this.selectedKitchenId();
    if (!kitchenId) {
      this.actionMessage.set('Select a kitchen first.');
      return false;
    }

    const stringRequest = {
      orderId,
      newStatus: status,
      updatedBy: this.activeSession()?.loginUsername || this.kitchenTitle(),
      notes
    };

    const normalized = status.trim().toLowerCase();
    const numericStatus = normalized === 'paid'
      ? 2
      : normalized === 'failed'
        ? 3
        : normalized === 'refunded'
          ? 4
          : 1;

    const numericRequest = {
      orderId,
      newStatus: numericStatus,
      updatedBy: this.activeSession()?.loginUsername || this.kitchenTitle(),
      notes
    };

    const applySuccess = async (): Promise<boolean> => {
      this.actionMessage.set('Payment status updated.');
      const clearTimer = setTimeout(() => this.actionMessage.set(''), 3000);
      this.pulseTimers.add(clearTimer);
      await this.loadOrdersFromApi();
      return true;
    };

    try {
      const response = await firstValueFrom(this.kitchenApi.updatePaymentStatus(orderId, stringRequest));
      if (response.success) {
        return await applySuccess();
      }

      const fallback = await firstValueFrom(this.kitchenApi.updatePaymentStatus(orderId, numericRequest));
      if (fallback.success) {
        return await applySuccess();
      }

      const apiError = fallback.errors && fallback.errors.length > 0 ? fallback.errors[0] : null;
      this.actionMessage.set(apiError || fallback.message || 'Unable to update payment status right now.');
      const clearTimer = setTimeout(() => this.actionMessage.set(''), 4000);
      this.pulseTimers.add(clearTimer);
      return false;
    } catch (error) {
      try {
        const fallback = await firstValueFrom(this.kitchenApi.updatePaymentStatus(orderId, numericRequest));
        if (fallback.success) {
          return await applySuccess();
        }

        const apiError = fallback.errors && fallback.errors.length > 0 ? fallback.errors[0] : null;
        this.actionMessage.set(apiError || fallback.message || 'Unable to update payment status right now.');
        const clearTimer = setTimeout(() => this.actionMessage.set(''), 4000);
        this.pulseTimers.add(clearTimer);
        return false;
      } catch (fallbackError) {
        const httpError = fallbackError instanceof HttpErrorResponse
          ? fallbackError
          : (error instanceof HttpErrorResponse ? error : null);

        this.actionMessage.set(httpError?.error?.error?.message || httpError?.error?.message || 'Payment update failed. Check API connection.');
        const clearTimer = setTimeout(() => this.actionMessage.set(''), 4000);
        this.pulseTimers.add(clearTimer);
        return false;
      }
    }
  }

  markCodPaid(orderId: number): void {
    void this.updatePaymentStatus(orderId, 'Paid');
  }

  private normalizeMobileNumber(rawValue: unknown, fallbackValue: unknown): string {
    const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (raw) return raw;
    return typeof fallbackValue === 'string' ? fallbackValue.trim() : '';
  }

  private normalizeRoomNumber(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }
    const cleaned = value.replace(/[^\x20-\x7E]/g, '').trim();
    if (!cleaned || cleaned === '-') {
      return undefined;
    }
    return cleaned;
  }

  private loadPrintedKotMap(): Record<number, string> {
    if (typeof window === 'undefined') {
      return {};
    }

    const raw = localStorage.getItem(this.printedKotStorageKey);
    if (!raw) {
      return {};
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }

      const next: Record<number, string> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        const orderId = Number(key);
        if (!Number.isFinite(orderId) || orderId <= 0 || typeof value !== 'string' || !value.trim()) {
          return;
        }
        next[orderId] = value;
      });
      return next;
    } catch {
      return {};
    }
  }
  private loadKitchenSession(): KitchenSessionState | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const raw = localStorage.getItem(this.kitchenSessionKey);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<KitchenSessionState>;
      const kitchenId = Number(parsed.kitchenId);
      if (!Number.isFinite(kitchenId) || kitchenId <= 0) {
        return null;
      }

      return {
        kitchenId,
        kitchenName: String(parsed.kitchenName ?? '').trim() || 'Kitchen Dashboard',
        cityName: String(parsed.cityName ?? '').trim() || 'Unknown City',
        loginUsername: String(parsed.loginUsername ?? '').trim()
      };
    } catch {
      const kitchenId = Number(raw);
      if (!Number.isFinite(kitchenId) || kitchenId <= 0) {
        return null;
      }

      return {
        kitchenId,
        kitchenName: 'Kitchen Dashboard',
        cityName: 'Unknown City',
        loginUsername: ''
      };
    }
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
























