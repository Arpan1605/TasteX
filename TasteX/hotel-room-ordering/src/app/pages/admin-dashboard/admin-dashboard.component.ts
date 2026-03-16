import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  AdminApiService,
  AdminCityDto,
  AdminHotelDto,
  AdminKitchenDto,
  AdminMenuCategoryDto,
  UpsertCategoryRequest,
  UpsertCityRequest,
  UpsertHotelRequest,
  UpsertHotelMenuItemRequest,
  UpsertKitchenRequest
} from '../../services/admin-api.service';
import { KitchenApiService, KitchenOrderDto } from '../../services/kitchen-api.service';
import { MockStoreService } from '../../services/mock-store.service';
import { hashMockPassword } from '../../utils/mock-password';
import { PaymentStatus } from '../../models/domain.models';

type StatusKey = 'Accepted' | 'Preparing' | 'Ready' | 'Delivered' | 'Rejected';
type AdminSection = 'Overview' | 'Cities' | 'Kitchens' | 'Hotels' | 'Menu' | 'QR Codes' | 'Reports';
type EditMode = 'base' | null;
type FoodType = 'Veg' | 'NonVeg';

type KitchenProfile = {
  kitchenId: number;
  loginUsername: string;
  passwordHash: string;
  isActive: boolean;
};

type AdminNotification = { id: number; orderId: number; message: string; createdAt: string };

type KitchenCard = {
  kitchenId: number;
  cityId: number;
  cityName: string;
  name: string;
  addressLine: string;
  contactPhone: string;
  managerName: string;
  isActive: boolean;
  hotelsCount: number;
  ordersCount: number;
  revenue: number;
  loginUsername: string;
  hasPasswordConfigured: boolean;
};

type HotelCard = {
  hotelId: number;
  cityId: number;
  cityName: string;
  kitchenId: number;
  kitchenName: string;
  hotelCode: string;
  name: string;
  addressLine: string;
  roomCount: number;
  isActive: boolean;
  ordersCount: number;
  revenue: number;
  qrCodeUrl: string;
};

type MenuItemCard = {
  itemId: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  isActive: boolean;
  prepTimeMinutes: number;
  imageUrl: string;
  availableKitchenIds: number[];
  baseInventory: number;
};

type MenuCategoryCard = {
  categoryId: number;
  categoryName: string;
  categoryIcon: string;
  sortOrder: number;
  items: MenuItemCard[];
};

type DashboardOrderRow = ReturnType<MockStoreService['getDashboardOrders']>[number];

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnDestroy {
  private readonly store = inject(MockStoreService);
  private readonly adminApi = inject(AdminApiService);
  private readonly kitchenApi = inject(KitchenApiService);
  private readonly router = inject(Router);

  selectedSection = signal<AdminSection>('Overview');

  showAddCityModal = signal(false);
  editingCityId = signal<number | null>(null);
  editingMode = signal<EditMode>(null);
  cityNameInput = signal('');
  cityStateInput = signal('');
  cityActiveInput = signal(true);
  cityFormError = signal('');

  showKitchenModal = signal(false);
  editingKitchenId = signal<number | null>(null);
  kitchenNameInput = signal('');
  kitchenCityIdInput = signal<number | null>(null);
  kitchenAddressInput = signal('');
  kitchenPhoneInput = signal('');
  kitchenManagerInput = signal('');
  kitchenActiveInput = signal(true);
  kitchenLoginUsernameInput = signal('');
  kitchenLoginPasswordInput = signal('');
  kitchenFormError = signal('');

  showHotelModal = signal(false);
  editingHotelId = signal<number | null>(null);
  hotelNameInput = signal('');
  hotelCityIdInput = signal<number | null>(null);
  hotelKitchenIdInput = signal<number | null>(null);
  hotelAddressInput = signal('');
  hotelRoomCountInput = signal('');
  hotelActiveInput = signal(true);
  hotelFormError = signal('');
  hotelQrPreviewUrl = signal('');
  hotelQrPayload = signal('');

  showAddItemModal = signal(false);
  showCategoryModal = signal(false);
  editingCategoryId = signal<number | null>(null);
  categoryNameInput = signal('');
  categorySortInput = signal('1');
  categoryIconInput = signal('');
  categoryFormError = signal('');

  itemNameInput = signal('');
  itemCategoryIdInput = signal<number | null>(null);
  itemDescriptionInput = signal('');
  itemPriceInput = signal('');
  itemPrepTimeInput = signal('15');
  itemFoodTypeInput = signal<FoodType>('Veg');
  itemImageUrlInput = signal('');
  itemKitchenIdsInput = signal<number[]>([]);
  itemActiveInput = signal(true);
  itemInventoryInput = signal('50');
  itemFormError = signal('');
  editingItemId = signal<number | null>(null);
  qrCityFilter = signal<number | null>(null);
  qrSearchInput = signal('');
  reportCityFilter = signal<number | null>(null);
  reportHotelFilter = signal<number | null>(null);
  reportKitchenFilter = signal<number | null>(null);
  reportStatusFilter = signal<string>('All');
  reportPaymentFilter = signal<string>('All');
  reportMonthFilter = signal('');
  reportDateFrom = signal('');
  reportDateTo = signal('');

  adminCities = signal<AdminCityDto[]>([]);
  kitchenCards = signal<KitchenCard[]>([]);
  hotelCards = signal<HotelCard[]>([]);
  menuCategories = signal<MenuCategoryCard[]>([]);
  selectedMenuHotelId = signal<number | null>(null);
  backendDashboardRows = signal<DashboardOrderRow[]>([]);
  dashboardApiLoaded = signal(false);
  unreadNew = signal(0);
  highlightNew = signal(false);
  adminNotificationsOpen = signal(false);
  notificationToasts = signal<AdminNotification[]>([]);
  recentKitchenPasswords = signal<Record<number, string>>({});

  private readonly knownOrderIds = new Set<number>();
  private readonly pulseTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly kitchenProfilesStorageKey = 'tx_kitchen_profiles_v1';
  private readonly dashboardPollTimer: ReturnType<typeof setInterval> | null;
  private toastId = 0;

  private citiesLoaded = false;
  private kitchensLoaded = false;
  private hotelsLoaded = false;
  private menuLoaded = false;

  readonly menuHotelOptions = computed(() => this.hotelCards().slice().sort((a, b) => a.name.localeCompare(b.name)));
  readonly chipNewCount = computed(() => this.unreadNew() || this.dashboardRows().filter((row) => this.isNewOrder(row)).length);

  readonly sidebarItems: { label: AdminSection; icon: string }[] = [
    { label: 'Overview', icon: 'pi pi-chart-bar' },
    { label: 'Cities', icon: 'pi pi-map-marker' },
    { label: 'Kitchens', icon: 'pi pi-home' },
    { label: 'Hotels', icon: 'pi pi-building' },
    { label: 'Menu', icon: 'pi pi-sparkles' },
    { label: 'QR Codes', icon: 'pi pi-qrcode' },
    { label: 'Reports', icon: 'pi pi-chart-line' }
  ];

  readonly dashboardRows = computed(() => this.dashboardApiLoaded() ? this.backendDashboardRows() : this.store.getDashboardOrders());
  readonly totalRevenue = computed(() => this.dashboardRows().reduce((sum, row) => sum + row.totalAmount, 0));
  readonly totalOrders = computed(() => this.dashboardRows().length);
  readonly deliveredOrders = computed(() => this.dashboardRows().filter((row) => row.status === 'Delivered').length);
  readonly avgOrderValue = computed(() => {
    const total = this.totalOrders();
    return total === 0 ? 0 : Math.round(this.totalRevenue() / total);
  });

  readonly revenueByCity = computed(() => {
    const map = new Map<string, number>();
    this.dashboardRows().forEach((row) => {
      const cityName = this.hotelCards().find((entry) => entry.hotelId === row.hotelId)?.cityName ?? 'Unknown';
      map.set(cityName, (map.get(cityName) ?? 0) + row.totalAmount);
    });
    const values = Array.from(map, ([city, revenue]) => ({ city, revenue }));
    const max = Math.max(1, ...values.map((entry) => entry.revenue));
    return values.map((entry) => ({ ...entry, height: Math.max(12, Math.round((entry.revenue / max) * 100)) }));
  });

  readonly sevenDayTrend = computed(() => {
    const labels: string[] = [];
    const values: number[] = [];
    for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
      const day = new Date();
      day.setDate(day.getDate() - dayOffset);
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
      labels.push(day.toLocaleDateString('en-IN', { weekday: 'short' }));
      const totalForDay = this.dashboardRows()
        .filter((row) => {
          const rowDate = new Date(row.createdAt);
          const rowKey = `${rowDate.getFullYear()}-${rowDate.getMonth()}-${rowDate.getDate()}`;
          return rowKey === key;
        })
        .reduce((sum, row) => sum + row.totalAmount, 0);
      values.push(totalForDay);
    }
    const max = Math.max(1, ...values);
    return labels.map((label, index) => ({
      label,
      value: values[index],
      x: Math.round((index / 6) * 100),
      y: 100 - Math.round((values[index] / max) * 100)
    }));
  });

  readonly statusDistribution = computed(() => {
    const totals: Record<StatusKey, number> = { Accepted: 0, Preparing: 0, Ready: 0, Delivered: 0, Rejected: 0 };
    this.dashboardRows().forEach((row) => {
      if (row.status in totals) totals[row.status as StatusKey] += 1;
    });
    const totalCount = Object.values(totals).reduce((sum, count) => sum + count, 0) || 1;
    const deliveredPct = Math.round((totals.Delivered / totalCount) * 100);
    return { delivered: totals.Delivered, active: totals.Accepted + totals.Preparing + totals.Ready, rejected: totals.Rejected, deliveredPct };
  });

  readonly recentOrders = computed(() => this.dashboardRows().slice(0, 6));
  readonly reservedItemQty = computed(() => {
    const map = new Map<string, number>();
    this.dashboardRows().filter((o) => o.status !== 'Rejected').forEach((order) => {
      order.lines.forEach((line) => {
        const key = `${order.hotelId}:${line.itemId}`;
        map.set(key, (map.get(key) ?? 0) + line.quantity);
      });
    });
    return map;
  });

  readonly cityCards = computed(() => {
    return this.adminCities().map((city) => {
      const cityHotels = this.hotelCards().filter((hotel) => hotel.cityId === city.cityId);
      return {
        id: city.cityId,
        name: city.name,
        state: city.stateName ?? '',
        kitchens: city.kitchensCount,
        hotels: city.hotelsCount || cityHotels.length,
        revenue: city.revenue ?? cityHotels.reduce((sum, hotel) => sum + hotel.revenue, 0),
        isActive: city.isActive,
        isCustom: false
      };
    });
  });
  readonly qrCards = computed(() =>
    this.hotelCards()
      .map((hotel) => ({
        hotelId: hotel.hotelId,
        name: hotel.name,
        cityId: hotel.cityId,
        cityName: hotel.cityName,
        routeUrl: this.getGuestRouteUrl(hotel.hotelCode),
        qrCodeUrl: hotel.qrCodeUrl
      }))
      .filter((row) => {
        const cityMatch = this.qrCityFilter() ? row.cityId === this.qrCityFilter() : true;
        const q = this.qrSearchInput().trim().toLowerCase();
        const searchMatch = q ? row.name.toLowerCase().includes(q) || row.routeUrl.toLowerCase().includes(q) : true;
        return cityMatch && searchMatch;
      })
  );

  readonly reportHotelOptions = computed(() => {
    const cityId = this.reportCityFilter();
    const base = this.hotelCards();
    return cityId ? base.filter((h) => h.cityId === cityId) : base;
  });

  readonly reportOrders = computed(() =>
    this.dashboardRows().filter((row) => {
      const cityId = this.reportCityFilter();
      const hotelId = this.reportHotelFilter();
      const kitchenId = this.reportKitchenFilter();
      const status = this.reportStatusFilter();
      const payment = this.reportPaymentFilter();
      const month = this.reportMonthFilter();
      const from = this.reportDateFrom();
      const to = this.reportDateTo();

      if (cityId) {
        const hotel = this.hotelCards().find((h) => h.hotelId === row.hotelId);
        if (!hotel || hotel.cityId !== cityId) {
          return false;
        }
      }
      if (hotelId && row.hotelId !== hotelId) {
        return false;
      }
      if (kitchenId && row.kitchenId !== kitchenId) {
        return false;
      }
      if (status !== 'All' && row.status !== status) {
        return false;
      }
      if (payment !== 'All' && row.paymentMethod !== payment) {
        return false;
      }

      const created = new Date(row.createdAt);
      if (month) {
        const [year, monthValue] = month.split('-').map((part) => Number(part));
        if (created.getFullYear() !== year || created.getMonth() + 1 !== monthValue) {
          return false;
        }
      }
      if (from) {
        const fromDate = new Date(`${from}T00:00:00`);
        if (created < fromDate) {
          return false;
        }
      }
      if (to) {
        const toDate = new Date(`${to}T23:59:59`);
        if (created > toDate) {
          return false;
        }
      }

      return true;
    })
  );

  readonly reportTodayRevenue = computed(() => {
    const now = new Date();
    return this.reportOrders()
      .filter((row) => {
        const d = new Date(row.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      })
      .reduce((sum, row) => sum + row.totalAmount, 0);
  });

  readonly reportWeekRevenue = computed(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);
    return this.reportOrders().filter((row) => new Date(row.createdAt) >= weekStart).reduce((sum, row) => sum + row.totalAmount, 0);
  });

  readonly reportMonthRevenue = computed(() => {
    const now = new Date();
    return this.reportOrders()
      .filter((row) => {
        const d = new Date(row.createdAt);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((sum, row) => sum + row.totalAmount, 0);
  });

  readonly reportAvgServiceTime = computed(() => {
    const rows = this.reportOrders();
    if (!rows.length) {
      return 0;
    }
    const sum = rows.reduce((acc, row) => acc + (row.serviceTimeMins ?? 0), 0);
    return Math.round(sum / rows.length);
  });

  readonly reportRevenueByHotel = computed(() =>
    this.reportHotelOptions().map((hotel) => {
      const orders = this.reportOrders().filter((row) => row.hotelId === hotel.hotelId);
      const revenue = orders.reduce((sum, row) => sum + row.totalAmount, 0);
      const latestOrderDate = orders.length ? orders.map((row) => new Date(row.createdAt)).sort((a, b) => b.getTime() - a.getTime())[0] : null;
      return {
        hotelId: hotel.hotelId,
        hotelName: hotel.name,
        cityName: hotel.cityName,
        orderDate: latestOrderDate ? latestOrderDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
        ordersCount: orders.length,
        revenue,
        avgValue: orders.length ? Math.round(revenue / orders.length) : 0
      };
    })
  );

  readonly reportTopItems = computed(() => {
    const itemMap = new Map<number, { name: string; qty: number; revenue: number }>();
    const menuName = new Map<number, string>();
    this.menuCategories().forEach((cat) => cat.items.forEach((item) => menuName.set(item.itemId, item.name)));

    this.reportOrders().forEach((order) => {
      order.lines.forEach((line) => {
        const current = itemMap.get(line.itemId) ?? {
          name: menuName.get(line.itemId) ?? `Item ${line.itemId}`,
          qty: 0,
          revenue: 0
        };
        current.qty += line.quantity;
        current.revenue += line.quantity * line.unitPrice;
        itemMap.set(line.itemId, current);
      });
    });

    const list = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty);
    const max = Math.max(1, ...list.map((x) => x.qty));
    return list.slice(0, 8).map((entry) => ({
      ...entry,
      widthPct: Math.max(8, Math.round((entry.qty / max) * 100))
    }));
  });

  clearReportFilters(): void {
    this.reportCityFilter.set(null);
    this.reportHotelFilter.set(null);
    this.reportKitchenFilter.set(null);
    this.reportStatusFilter.set('All');
    this.reportPaymentFilter.set('All');
    this.reportMonthFilter.set('');
    this.reportDateFrom.set('');
    this.reportDateTo.set('');
  }

  onReportCityChanged(nextCityId: number | null): void {
    this.reportCityFilter.set(nextCityId);
    const currentHotel = this.reportHotelFilter();
    if (currentHotel && !this.reportHotelOptions().some((h) => h.hotelId === currentHotel)) {
      this.reportHotelFilter.set(null);
    }
  }

  downloadQrPng(url: string, hotelName: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${hotelName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`;
    a.target = '_blank';
    a.click();
  }

  downloadQrPdf(url: string, hotelName: string): void {
    const win = window.open('', '_blank', 'width=840,height=980');
    if (!win) {
      return;
    }

    win.document.write(`
      <html><head><title>${hotelName} QR</title></head>
      <body style="font-family:Arial, sans-serif;padding:24px;">
        <h2 style="margin:0 0 12px 0;">${hotelName}</h2>
        <img src="${url}" style="width:280px;height:280px;" alt="QR" />
        <p style="margin-top:12px;color:#475569;">Print or Save as PDF from browser dialog.</p>
      </body></html>
    `);
    win.document.close();
    win.focus();
    win.print();
  }

  exportReports(): void {
    const timestamp = new Date();
    const fileStamp = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}-${String(timestamp.getDate()).padStart(2, '0')}-${String(timestamp.getHours()).padStart(2, '0')}${String(timestamp.getMinutes()).padStart(2, '0')}`;
    const lines: string[] = [];

    lines.push('Hotel,City,Order Date,Orders,Revenue,Average Value');
    this.reportRevenueByHotel().forEach((row) => {
      lines.push([
        this.csvEscape(row.hotelName),
        this.csvEscape(row.cityName),
        this.csvEscape(row.orderDate),
        this.csvEscape(row.ordersCount),
        this.csvEscape(row.revenue),
        this.csvEscape(row.avgValue)
      ].join(','));
    });

    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `revenue-by-hotel-${fileStamp}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private getGuestBaseUrl(): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return 'http://localhost:4200';
  }

  private getGuestRouteUrl(hotelCode: string): string {
    return `${this.getGuestBaseUrl()}/guest/${hotelCode}`;
  }
  private formatReportCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  }

  private csvEscape(value: string | number | null | undefined): string {
    const normalized = String(value ?? '');
    return /[",\n]/.test(normalized) ? `"${normalized.replace(/"/g, '""')}"` : normalized;
  }

  private extractApiError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as {
        error?: { message?: string; code?: string; validationErrors?: Record<string, string[]> | null } | null;
        errors?: string[] | Record<string, string[]>;
        message?: string;
        title?: string;
      } | string | null;
      if (typeof payload === 'string' && payload.trim()) {
        return payload;
      }
      if (payload && typeof payload === 'object') {
        if (payload.error?.message && payload.error.message.trim()) {
          return payload.error.message;
        }

        const firstError = Array.isArray(payload.errors)
          ? payload.errors.find((entry) => typeof entry === 'string' && entry.trim())
          : null;
        if (firstError) {
          return firstError;
        }

        if (payload.error?.validationErrors && typeof payload.error.validationErrors === 'object') {
          const validationMessage = Object.values(payload.error.validationErrors)
            .flat()
            .find((entry) => typeof entry === 'string' && entry.trim());
          if (validationMessage) {
            return validationMessage;
          }
        }

        if (payload.errors && !Array.isArray(payload.errors) && typeof payload.errors === 'object') {
          const validationMessage = Object.values(payload.errors)
            .flat()
            .find((entry) => typeof entry === 'string' && entry.trim());
          if (validationMessage) {
            return validationMessage;
          }
        }

        if (typeof payload.message === 'string' && payload.message.trim()) {
          return payload.message;
        }
        if (typeof payload.title === 'string' && payload.title.trim()) {
          return payload.title;
        }
      }
      if (error.status === 0) {
        return 'API request failed. Ensure the .NET API is running on http://localhost:5187.';
      }
      return `Request failed (${error.status}). Check backend logs and SQL connection.`;
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  constructor() {
    this.adminCities.set([]);
    this.kitchenCards.set([]);
    this.hotelCards.set([]);
    this.selectedMenuHotelId.set(null);
    this.menuCategories.set([]);

    this.dashboardPollTimer = typeof window !== 'undefined'
      ? setInterval(() => { void this.loadDashboardOrdersFromApi(); }, 10000)
      : null;

    effect(() => {
      const rows = this.dashboardRows();

      if (this.knownOrderIds.size === 0) {
        rows.forEach((row) => this.knownOrderIds.add(row.id));
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
      incoming.forEach((row) => this.pushAdminToast(row));
    });

    void this.loadCitiesFromApi();
    void this.loadKitchensFromApi();
    void this.loadHotelsFromApi();
    void this.loadDashboardOrdersFromApi();
  }

  ngOnDestroy(): void {
    this.pulseTimers.forEach((timer) => clearTimeout(timer));
    this.pulseTimers.clear();
    if (this.dashboardPollTimer) {
      clearInterval(this.dashboardPollTimer);
    }
  }

  selectSection(section: AdminSection): void {
    this.selectedSection.set(section);
    if (section === 'Cities' && !this.citiesLoaded) void this.loadCitiesFromApi();
    if (section === 'Kitchens' && !this.kitchensLoaded) void this.loadKitchensFromApi();
    if (section === 'Hotels' && !this.hotelsLoaded) void this.loadHotelsFromApi();
    if (section === 'Menu' && !this.selectedMenuHotelId() && this.hotelCards().length > 0) {
      void this.selectMenuHotel(this.hotelCards()[0].hotelId);
    }
  }

  isSection(section: AdminSection): boolean { return this.selectedSection() === section; }
  async selectMenuHotel(hotelId: number | null): Promise<void> {
    this.selectedMenuHotelId.set(hotelId);
    this.menuCategories.set([]);
    if (!hotelId) {
      this.menuLoaded = true;
      return;
    }
    await this.loadMenuForHotel(hotelId);
  }

  signOut(): void {
    this.adminNotificationsOpen.set(false);
    this.router.navigate(['/admin/login']);
  }

  openAdminNotifications(): void {
    const nextOpen = !this.adminNotificationsOpen();
    this.adminNotificationsOpen.set(nextOpen);
    if (nextOpen) {
      this.unreadNew.set(0);
      this.highlightNew.set(false);
    }
  }

  viewAdminNotification(orderId: number): void {
    this.selectedSection.set('Overview');
    this.adminNotificationsOpen.set(false);
    this.unreadNew.set(0);
    this.highlightNew.set(false);
    queueMicrotask(() => document.querySelector('.recent-orders-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  closeAdminNotification(id: number): void {
    this.notificationToasts.update((items) => items.filter((item) => item.id !== id));
  }

  clearAdminNotifications(): void {
    this.notificationToasts.set([]);
    this.adminNotificationsOpen.set(false);
    this.highlightNew.set(false);
    this.unreadNew.set(0);
  }

  isNewOrder(row: { status: string; createdAt: string; updatedAt: string }): boolean {
    const created = new Date(row.createdAt).getTime();
    return row.status === 'Accepted' && row.createdAt === row.updatedAt && (Date.now() - created) <= 10 * 60 * 1000;
  }

  private pushAdminToast(row: DashboardOrderRow): void {
    const room = row.roomNumber ? ' - Room ' + row.roomNumber : '';
    const id = ++this.toastId;
    this.notificationToasts.update((items) => [{ id, orderId: row.id, message: row.orderNo + ' - ' + row.hotelName + room, createdAt: row.createdAt }, ...items].slice(0, 12));
  }
  private async loadDashboardOrdersFromApi(): Promise<void> {
    const kitchenIds = this.kitchenCards().map((entry) => entry.kitchenId).filter((id) => Number.isFinite(id) && id > 0);
    if (kitchenIds.length === 0) {
      if (this.kitchensLoaded) {
        if (!this.dashboardApiLoaded()) {
          this.knownOrderIds.clear();
        }
        this.backendDashboardRows.set([]);
        this.dashboardApiLoaded.set(true);
      }
      return;
    }

    try {
      const responses = await Promise.all(
        kitchenIds.map(async (kitchenId) => {
          const response = await firstValueFrom(this.kitchenApi.getOrders({ kitchenId, pageNumber: 1, pageSize: 200 }));
          return { kitchenId, response };
        })
      );

      const nextRows = responses
        .flatMap((entry) => {
          const orders = entry.response.success && entry.response.data?.orders ? entry.response.data.orders : [];
          return orders.map((order) => this.mapKitchenOrderToDashboardRow(order, entry.kitchenId));
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (!this.dashboardApiLoaded()) {
        this.knownOrderIds.clear();
      }
      this.backendDashboardRows.set(nextRows);
      this.dashboardApiLoaded.set(true);
    } catch {
      // Keep current dashboard snapshot on transient API failures.
    }
  }

  private mapKitchenOrderToDashboardRow(order: KitchenOrderDto, kitchenId: number): DashboardOrderRow {
    return {
      id: order.orderId,
      orderNo: order.orderNumber,
      hotelId: order.hotelId,
      hotelName: order.hotelName,
      kitchenId,
      mobile: order.maskedMobileNumber,
      roomNumber: (order.roomNumber ?? '').trim() || undefined,
      lines: (order.lines ?? []).map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice
      })),
      totalAmount: order.totalAmount,
      paymentMethod: this.mapKitchenPaymentMethod(order.paymentMethod),
      paymentStatus: this.mapKitchenPaymentStatus(order.paymentStatus),
      status: this.mapKitchenOrderStatus(order.orderStatus),
      createdAt: order.createdAtUtc,
      updatedAt: order.updatedAtUtc,
      serviceTimeMins: order.serviceTimeMinutes,
      acceptedAt: undefined,
      preparingStartedAt: undefined,
      readyAt: undefined,
      deliveredAt: undefined,
      rejectedAt: undefined,
      rejectionReason: undefined
    };
  }

  private mapKitchenOrderStatus(status: number | string): StatusKey {
    if (typeof status === 'string') {
      const normalized = status.trim().toLowerCase();
      if (normalized === 'preparing') return 'Preparing';
      if (normalized === 'ready') return 'Ready';
      if (normalized === 'delivered') return 'Delivered';
      if (normalized === 'cancelled' || normalized === 'rejected') return 'Rejected';
      return 'Accepted';
    }

    switch (status) {
      case 2: return 'Preparing';
      case 3: return 'Ready';
      case 4: return 'Delivered';
      case 5: return 'Rejected';
      default: return 'Accepted';
    }
  }

  private mapKitchenPaymentMethod(_method: number | string): 'COD' {
    return 'COD';
  }

  private mapKitchenPaymentStatus(status: number | string): PaymentStatus {
    if (typeof status === 'string') {
      const normalized = status.trim().toLowerCase();
      if (normalized === 'paid') return 'Paid';
      if (normalized === 'failed') return 'Failed';
      return 'Pending';
    }

    switch (status) {
      case 2: return 'Paid';
      case 3: return 'Failed';
      default: return 'Pending';
    }
  }
  openAddCityModal(): void {
    this.showAddCityModal.set(true);
    this.editingCityId.set(null);
    this.editingMode.set(null);
    this.cityNameInput.set('');
    this.cityStateInput.set('');
    this.cityActiveInput.set(true);
    this.cityFormError.set('');
  }

  openEditCityModal(cityId: number): void {
    const city = this.cityCards().find((entry) => entry.id === cityId);
    if (!city) return;
    this.editingCityId.set(city.id);
    this.editingMode.set('base');
    this.cityNameInput.set(city.name);
    this.cityStateInput.set(city.state);
    this.cityActiveInput.set(city.isActive);
    this.cityFormError.set('');
    this.showAddCityModal.set(true);
  }

  closeAddCityModal(): void {
    this.showAddCityModal.set(false);
    this.editingCityId.set(null);
    this.editingMode.set(null);
    this.cityFormError.set('');
  }

  isEditMode(): boolean { return this.editingMode() !== null; }
  toggleCityActive(): void { this.cityActiveInput.update((value) => !value); }
  async saveCity(): Promise<void> {
    const name = this.cityNameInput().trim();
    const state = this.cityStateInput().trim();
    if (!name || !state) {
      this.cityFormError.set('City Name and State are required.');
      return;
    }
    const currentId = this.editingCityId();
    const exists = this.cityCards().some((city) => city.name.toLowerCase() === name.toLowerCase() && city.id !== currentId);
    if (exists) {
      this.cityFormError.set('City already exists.');
      return;
    }
    const payload: UpsertCityRequest = { name, stateName: state, isActive: this.cityActiveInput() };
    try {
      const response = currentId
        ? await firstValueFrom(this.adminApi.updateCity(currentId, payload))
        : await firstValueFrom(this.adminApi.createCity(payload));
      if (!response.success || !response.data) {
        this.cityFormError.set('Unable to save city to the database.');
        return;
      }
      const nextCity = response.data;
      this.adminCities.update((items) => {
        const existingIndex = items.findIndex((entry) => entry.cityId === nextCity.cityId);
        if (existingIndex < 0) {
          return [...items, nextCity].sort((a, b) => a.name.localeCompare(b.name));
        }
        return items
          .map((entry) => entry.cityId === nextCity.cityId ? nextCity : entry)
          .sort((a, b) => a.name.localeCompare(b.name));
      });
      this.closeAddCityModal();
    } catch (error) {
      this.cityFormError.set(this.extractApiError(error, 'Unable to save city to the database. Check the API and SQL connection.'));
    }
  }
  openAddKitchenModal(): void {
    const nextKitchenId = Math.max(10000, ...this.kitchenCards().map((entry) => entry.kitchenId)) + 1;
    this.showKitchenModal.set(true);
    this.editingKitchenId.set(null);
    this.kitchenNameInput.set('');
    this.kitchenCityIdInput.set(null);
    this.kitchenAddressInput.set('');
    this.kitchenPhoneInput.set('');
    this.kitchenManagerInput.set('');
    this.kitchenActiveInput.set(true);
    this.kitchenLoginUsernameInput.set(this.generateKitchenUsername('', nextKitchenId));
    this.kitchenLoginPasswordInput.set(this.generateKitchenPassword());
    this.kitchenFormError.set('');
  }

  openEditKitchenModal(kitchenId: number): void {
    const kitchen = this.kitchenCards().find((entry) => entry.kitchenId === kitchenId);
    if (!kitchen) return;
    this.editingKitchenId.set(kitchenId);
    this.kitchenNameInput.set(kitchen.name);
    this.kitchenCityIdInput.set(kitchen.cityId);
    this.kitchenAddressInput.set(kitchen.addressLine);
    this.kitchenPhoneInput.set(kitchen.contactPhone);
    this.kitchenManagerInput.set(kitchen.managerName);
    this.kitchenActiveInput.set(kitchen.isActive);
    this.kitchenLoginUsernameInput.set(kitchen.loginUsername);
    this.kitchenLoginPasswordInput.set('');
    this.kitchenFormError.set('');
    this.showKitchenModal.set(true);
  }

  closeKitchenModal(): void {
    this.showKitchenModal.set(false);
    this.editingKitchenId.set(null);
    this.kitchenFormError.set('');
  }

  regenerateKitchenPassword(): void {
    this.kitchenLoginPasswordInput.set(this.generateKitchenPassword());
  }

  isKitchenEditMode(): boolean { return this.editingKitchenId() !== null; }
  toggleKitchenActive(): void { this.kitchenActiveInput.update((value) => !value); }

  async saveKitchen(): Promise<void> {
    const name = this.kitchenNameInput().trim();
    const cityId = this.kitchenCityIdInput();
    const addressLine = this.kitchenAddressInput().trim();
    const contactPhone = this.kitchenPhoneInput().trim();
    const managerName = this.kitchenManagerInput().trim();
    const editingId = this.editingKitchenId();
    const existingKitchen = editingId ? this.kitchenCards().find((entry) => entry.kitchenId === editingId) : null;
    const loginUsername = this.kitchenLoginUsernameInput().trim().toLowerCase();
    const loginPassword = this.kitchenLoginPasswordInput().trim();

    if (!name || !cityId) {
      this.kitchenFormError.set('Kitchen Name and City are required.');
      return;
    }

    if (!loginUsername) {
      this.kitchenFormError.set('Kitchen login username is required.');
      return;
    }

    if (!loginPassword && !existingKitchen?.hasPasswordConfigured) {
      this.kitchenFormError.set('Kitchen login password is required.');
      return;
    }

    const duplicate = this.kitchenCards().some((entry) => entry.name.toLowerCase() === name.toLowerCase() && entry.kitchenId !== editingId);
    if (duplicate) {
      this.kitchenFormError.set('Kitchen already exists.');
      return;
    }

    const duplicateLogin = this.kitchenCards().some((entry) => entry.loginUsername.toLowerCase() === loginUsername && entry.kitchenId !== editingId);
    if (duplicateLogin) {
      this.kitchenFormError.set('Kitchen login username already exists.');
      return;
    }

    const payload: UpsertKitchenRequest = {
      cityId,
      name,
      addressLine,
      contactPhone,
      managerName,
      isActive: this.kitchenActiveInput(),
      loginUsername,
      loginPassword: loginPassword || undefined
    };
    try {
      const response = editingId
        ? await firstValueFrom(this.adminApi.updateKitchen(editingId, payload))
        : await firstValueFrom(this.adminApi.createKitchen(payload));

      if (!response.success || !response.data) {
        this.kitchenFormError.set('Unable to save kitchen to the database.');
        return;
      }

      const persisted = this.mapKitchenDtoToCard(response.data);
      this.upsertKitchenCard(persisted, loginPassword || undefined);
      this.closeKitchenModal();
    } catch {
      this.kitchenFormError.set('Unable to save kitchen to the database. Check the API and SQL connection.');
    }
  }

  copyKitchenCredentials(kitchenId?: number): void {
    const username = this.kitchenLoginUsernameInput().trim();
    const password = this.kitchenLoginPasswordInput().trim();
    const fallbackKitchenId = kitchenId ?? this.editingKitchenId() ?? undefined;

    if (username && password) {
      this.copyText('Username: ' + username + '\nPassword: ' + password);
      return;
    }

    if (fallbackKitchenId) {
      const kitchen = this.kitchenCards().find((entry) => entry.kitchenId === fallbackKitchenId);
      if (!kitchen) {
        return;
      }

      const recentPassword = this.recentKitchenPasswords()[fallbackKitchenId];
      if (recentPassword) {
        this.copyText('Username: ' + kitchen.loginUsername + '\nPassword: ' + recentPassword);
        return;
      }

      this.copyText('Username: ' + kitchen.loginUsername + '\nPassword: hidden. Use Edit Kitchen to issue a new password.');
    }
  }

  copyKitchenUsername(kitchenId: number): void {
    const kitchen = this.kitchenCards().find((entry) => entry.kitchenId === kitchenId);
    if (!kitchen) {
      return;
    }

    this.copyText(kitchen.loginUsername);
  }

  private copyText(value: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(value);
      return;
    }

    const input = document.createElement('textarea');
    input.value = value;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
  }

  openAddHotelModal(): void {
    this.editingHotelId.set(null);
    this.hotelNameInput.set('');
    this.hotelCityIdInput.set(null);
    this.hotelKitchenIdInput.set(null);
    this.hotelAddressInput.set('');
    this.hotelRoomCountInput.set('');
    this.hotelActiveInput.set(true);
    this.hotelFormError.set('');
    this.hotelQrPreviewUrl.set('');
    this.hotelQrPayload.set('');
    this.showHotelModal.set(true);
  }

  openEditHotelModal(hotelId: number): void {
    const hotel = this.hotelCards().find((entry) => entry.hotelId === hotelId);
    if (!hotel) return;
    this.editingHotelId.set(hotel.hotelId);
    this.hotelNameInput.set(hotel.name);
    this.hotelCityIdInput.set(hotel.cityId);
    this.hotelKitchenIdInput.set(hotel.kitchenId);
    this.hotelAddressInput.set(hotel.addressLine);
    this.hotelRoomCountInput.set(String(hotel.roomCount || ''));
    this.hotelActiveInput.set(hotel.isActive);
    this.hotelFormError.set('');
    this.hotelQrPayload.set(this.getGuestRouteUrl(hotel.hotelCode));
    this.hotelQrPreviewUrl.set(hotel.qrCodeUrl);
    this.showHotelModal.set(true);
  }

  closeHotelModal(): void {
    this.showHotelModal.set(false);
    this.editingHotelId.set(null);
    this.hotelFormError.set('');
  }

  isHotelEditMode(): boolean { return this.editingHotelId() !== null; }
  toggleHotelActive(): void { this.hotelActiveInput.update((value) => !value); }

  filteredKitchensForHotelCity(): KitchenCard[] {
    const cityId = this.hotelCityIdInput();
    if (!cityId) return [];
    return this.kitchenCards().filter((kitchen) => kitchen.cityId === cityId);
  }

  onHotelCityChanged(nextCityId: number | null): void {
    this.hotelCityIdInput.set(nextCityId);
    const selectedKitchenId = this.hotelKitchenIdInput();
    if (!nextCityId || !selectedKitchenId) {
      this.hotelKitchenIdInput.set(null);
      return;
    }

    const exists = this.kitchenCards().some((kitchen) => kitchen.cityId === nextCityId && kitchen.kitchenId === selectedKitchenId);
    if (!exists) this.hotelKitchenIdInput.set(null);
  }

  generateHotelQrPreview(): void {
    const name = this.hotelNameInput().trim();
    const cityId = this.hotelCityIdInput();
    const kitchenId = this.hotelKitchenIdInput();
    if (!name || !cityId || !kitchenId) {
      this.hotelFormError.set('Hotel Name, City and Assigned Kitchen are required to generate QR.');
      return;
    }

    const code = `${name}-${cityId}-${kitchenId}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || `hotel-${Date.now()}`;
    const payload = this.getGuestRouteUrl(code);
    this.hotelQrPayload.set(payload);
    this.hotelQrPreviewUrl.set(`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(payload)}`);
    this.hotelFormError.set('');
  }

  async saveHotel(): Promise<void> {
    const name = this.hotelNameInput().trim();
    const cityId = this.hotelCityIdInput();
    const kitchenId = this.hotelKitchenIdInput();
    const addressLine = this.hotelAddressInput().trim();
    const roomCount = Number(this.hotelRoomCountInput());
    if (!name || !cityId || !kitchenId) {
      this.hotelFormError.set('Hotel Name, City and Assigned Kitchen are required.');
      return;
    }
    if (!Number.isFinite(roomCount) || roomCount < 0) {
      this.hotelFormError.set('Number of rooms must be a valid non-negative number.');
      return;
    }
    const payload: UpsertHotelRequest = { cityId, kitchenId, name, addressLine, roomCount, isActive: this.hotelActiveInput() };
    try {
      const editingId = this.editingHotelId();
      const response = editingId
        ? await firstValueFrom(this.adminApi.updateHotel(editingId, payload))
        : await firstValueFrom(this.adminApi.createHotel(payload));
      if (!response.success || !response.data) {
        this.hotelFormError.set('Unable to save hotel to the database.');
        return;
      }
      this.upsertHotelCard(this.mapHotelDtoToCard(response.data));
      this.closeHotelModal();
    } catch {
      this.hotelFormError.set('Unable to save hotel to the database. Check the API and SQL connection.');
    }
  }
  openAddCategoryModal(): void {
    this.editingCategoryId.set(null);
    this.categoryNameInput.set('');
    const nextSort = Math.max(1, ...this.menuCategories().map((x) => x.sortOrder)) + 1;
    this.categorySortInput.set(String(nextSort));
    this.categoryIconInput.set('');
    this.categoryFormError.set('');
    this.showCategoryModal.set(true);
  }

  openEditCategoryModal(categoryId: number): void {
    const category = this.menuCategories().find((entry) => entry.categoryId === categoryId);
    if (!category) return;
    this.editingCategoryId.set(category.categoryId);
    this.categoryNameInput.set(category.categoryName);
    this.categorySortInput.set(String(category.sortOrder));
    this.categoryIconInput.set(category.categoryIcon || '');
    this.categoryFormError.set('');
    this.showCategoryModal.set(true);
  }

  closeCategoryModal(): void {
    this.showCategoryModal.set(false);
    this.editingCategoryId.set(null);
    this.categoryIconInput.set('');
    this.categoryFormError.set('');
  }

  async saveCategory(): Promise<void> {
    const name = this.categoryNameInput().trim();
    const sortOrder = Number(this.categorySortInput());
    const categoryIcon = this.categoryIconInput().trim();
    const selectedHotelId = this.selectedMenuHotelId();
    if (!name) {
      this.categoryFormError.set('Category name is required.');
      return;
    }
    if (!Number.isFinite(sortOrder) || sortOrder <= 0) {
      this.categoryFormError.set('Sort order should be a positive number.');
      return;
    }

    const editingId = this.editingCategoryId();
    const duplicate = this.menuCategories().some((entry) => entry.categoryName.toLowerCase() === name.toLowerCase() && entry.categoryId !== editingId);
    if (duplicate) {
      this.categoryFormError.set('Category name already exists.');
      return;
    }
    if (!selectedHotelId) {
      this.categoryFormError.set('Select a hotel first.');
      return;
    }

    const payload: UpsertCategoryRequest = {
      name,
      categoryIcon: categoryIcon || undefined,
      sortOrder,
      isActive: true
    };
    try {
      const response = editingId
        ? await firstValueFrom(this.adminApi.updateCategory(editingId, payload))
        : await firstValueFrom(this.adminApi.createCategory(payload));
      if (!response.success || !response.data) {
        this.categoryFormError.set(response.error?.message?.trim() || 'Unable to save category to the database.');
        return;
      }
      this.closeCategoryModal();
      await this.loadMenuForHotel(selectedHotelId);
    } catch (error) {
      this.categoryFormError.set(this.extractApiError(error, 'Unable to save category to the database. Check the API and SQL connection.'));
    }
  }

  async deleteCategory(categoryId: number): Promise<void> {
    const category = this.menuCategories().find((entry) => entry.categoryId === categoryId);
    if (!category) return;
    const confirmText = category.items.length > 0
      ? `Delete "${category.categoryName}" and all ${category.items.length} items?`
      : `Delete "${category.categoryName}" category?`;
    if (!confirm(confirmText)) return;

    const selectedHotelId = this.selectedMenuHotelId();
    if (!selectedHotelId) {
      return;
    }

    try {
      const response = await firstValueFrom(this.adminApi.deleteCategory(categoryId));
      if (!response.success) {
        return;
      }
      await this.loadMenuForHotel(selectedHotelId);
    } catch {
      // keep current UI until API becomes available
    }
  }

  openAddItemModal(): void {
    const selectedHotel = this.hotelCards().find((entry) => entry.hotelId === this.selectedMenuHotelId());
    this.editingItemId.set(null);
    this.itemNameInput.set('');
    this.itemCategoryIdInput.set(this.menuCategories()[0]?.categoryId ?? null);
    this.itemDescriptionInput.set('');
    this.itemPriceInput.set('');
    this.itemPrepTimeInput.set('15');
    this.itemFoodTypeInput.set('Veg');
    this.itemImageUrlInput.set('');
    this.itemKitchenIdsInput.set(selectedHotel ? [selectedHotel.kitchenId] : []);
    this.itemActiveInput.set(true);
    this.itemInventoryInput.set('50');
    this.itemFormError.set('');
    this.showAddItemModal.set(true);
  }
  closeAddItemModal(): void {
    this.showAddItemModal.set(false);
    this.editingItemId.set(null);
    this.itemFormError.set('');
  }
  openEditItemModal(itemId: number): void {
    const selectedHotel = this.hotelCards().find((entry) => entry.hotelId === this.selectedMenuHotelId());
    const item = this.menuCategories().flatMap((category) => category.items).find((entry) => entry.itemId === itemId);
    if (!item) {
      return;
    }

    this.editingItemId.set(item.itemId);
    this.itemNameInput.set(item.name);
    this.itemCategoryIdInput.set(item.categoryId);
    this.itemDescriptionInput.set(item.description ?? '');
    this.itemPriceInput.set(String(item.price));
    this.itemPrepTimeInput.set(String(item.prepTimeMinutes ?? 15));
    this.itemFoodTypeInput.set(item.isVeg ? 'Veg' : 'NonVeg');
    this.itemImageUrlInput.set(item.imageUrl ?? '');
    this.itemKitchenIdsInput.set(item.availableKitchenIds.length > 0
      ? [...item.availableKitchenIds]
      : (selectedHotel ? [selectedHotel.kitchenId] : []));
    this.itemActiveInput.set(item.isActive);
    this.itemInventoryInput.set(String(item.baseInventory));
    this.itemFormError.set('');
    this.showAddItemModal.set(true);
  }

  toggleItemActive(): void { this.itemActiveInput.update((value) => !value); }
  isKitchenSelected(kitchenId: number): boolean { return this.itemKitchenIdsInput().includes(kitchenId); }

  toggleItemKitchen(kitchenId: number): void {
    this.itemKitchenIdsInput.update((ids) => ids.includes(kitchenId) ? ids.filter((id) => id !== kitchenId) : [...ids, kitchenId]);
  }

  selectAllItemKitchens(): void { this.itemKitchenIdsInput.set(this.kitchenCards().map((entry) => entry.kitchenId)); }
  deselectAllItemKitchens(): void { this.itemKitchenIdsInput.set([]); }

  async saveMenuItem(): Promise<void> {
    const name = this.itemNameInput().trim();
    const categoryId = this.itemCategoryIdInput();
    const description = this.itemDescriptionInput().trim();
    const price = Number(this.itemPriceInput());
    const prepTime = Number(this.itemPrepTimeInput());
    const openingInventory = Number(this.itemInventoryInput());
    const selectedHotelId = this.selectedMenuHotelId();

    if (!name || !categoryId) {
      this.itemFormError.set('Item Name and Category are required.');
      return;
    }
    if (!selectedHotelId) {
      this.itemFormError.set('Select a hotel first.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      this.itemFormError.set('Price must be a valid non-negative number.');
      return;
    }
    if (!Number.isFinite(openingInventory) || openingInventory < 0) {
      this.itemFormError.set('Opening inventory must be a valid non-negative number.');
      return;
    }

    const payload: UpsertHotelMenuItemRequest = {
      categoryId,
      name,
      description: description || undefined,
      price,
      isVeg: this.itemFoodTypeInput() === 'Veg',
      isActive: this.itemActiveInput(),
      prepTimeMinutes: Number.isFinite(prepTime) && prepTime > 0 ? prepTime : 15,
      imageUrl: this.itemImageUrlInput().trim() || undefined,
      inventoryQuantity: Math.max(0, Math.floor(openingInventory))
    };

    const editingItemId = this.editingItemId();
    try {
      const response = editingItemId
        ? await firstValueFrom(this.adminApi.updateHotelMenuItem(selectedHotelId, editingItemId, payload))
        : await firstValueFrom(this.adminApi.createHotelMenuItem(selectedHotelId, payload));
      if (!response.success || !response.data) {
        this.itemFormError.set(response.error?.message?.trim() || 'Unable to save menu item to the database.');
        return;
      }
      this.closeAddItemModal();
      await this.loadMenuForHotel(selectedHotelId);
    } catch (error) {
      this.itemFormError.set(this.extractApiError(error, 'Unable to save menu item to the database. Check the API and SQL connection.'));
    }
  }

  async deleteMenuItem(itemId: number): Promise<void> {
    const selectedHotelId = this.selectedMenuHotelId();
    if (!selectedHotelId) {
      return;
    }

    const item = this.menuCategories().flatMap((category) => category.items).find((entry) => entry.itemId === itemId);
    if (!item) {
      return;
    }

    if (!confirm(`Delete "${item.name}" from this hotel menu?`)) {
      return;
    }

    try {
      const response = await firstValueFrom(this.adminApi.deleteHotelMenuItem(selectedHotelId, itemId));
      if (!response.success) {
        this.itemFormError.set(response.error?.message?.trim() || 'Unable to delete menu item.');
        return;
      }

      this.itemFormError.set('');
      await this.loadMenuForHotel(selectedHotelId);
    } catch (error) {
      this.itemFormError.set(this.extractApiError(error, 'Unable to delete menu item. Check the API and SQL connection.'));
    }
  }
  async toggleMenuItemStatus(itemId: number): Promise<void> {
    const current = this.menuCategories().flatMap((category) => category.items).find((item) => item.itemId === itemId);
    const selectedHotelId = this.selectedMenuHotelId();
    if (!current || !selectedHotelId) return;
    const nextIsActive = !current.isActive;

    try {
      const response = await firstValueFrom(this.adminApi.updateHotelMenuItemStatus(selectedHotelId, itemId, { isActive: nextIsActive }));
      if (!response.success) {
        return;
      }
      await this.loadMenuForHotel(selectedHotelId);
    } catch {
      // keep current UI until API becomes available
    }
  }

  getMenuItemReservedQuantity(itemId: number): number {
    const hotelId = this.selectedMenuHotelId();
    if (!hotelId) {
      return 0;
    }
    return this.reservedItemQty().get(`${hotelId}:${itemId}`) ?? 0;
  }

  getMenuItemAvailableInventory(item: MenuItemCard): number {
    const reserved = this.getMenuItemReservedQuantity(item.itemId);
    return Math.max(0, item.baseInventory - reserved);
  }

  async updateMenuItemInventory(itemId: number, nextValue: number): Promise<void> {
    const selectedHotelId = this.selectedMenuHotelId();
    if (!selectedHotelId) return;

    const safeValue = Math.max(0, Math.floor(nextValue));
    try {
      const response = await firstValueFrom(this.adminApi.updateHotelMenuInventory(selectedHotelId, itemId, { inventoryQuantity: safeValue }));
      if (!response.success) {
        return;
      }
      await this.loadMenuForHotel(selectedHotelId);
    } catch {
      // keep current UI until API becomes available
    }
  }

  increaseMenuItemInventory(itemId: number, delta: number): void {
    const item = this.menuCategories().flatMap((category) => category.items).find((entry) => entry.itemId === itemId);
    if (!item) return;
    void this.updateMenuItemInventory(itemId, item.baseInventory + Math.max(1, Math.floor(delta)));
  }

  decreaseMenuItemInventory(itemId: number, delta: number): void {
    const item = this.menuCategories().flatMap((category) => category.items).find((entry) => entry.itemId === itemId);
    if (!item) return;
    void this.updateMenuItemInventory(itemId, item.baseInventory - Math.max(1, Math.floor(delta)));
  }

  increaseMenuItemAvailableInventory(itemId: number, delta: number): void {
    const item = this.menuCategories().flatMap((category) => category.items).find((entry) => entry.itemId === itemId);
    if (!item) return;
    const nextAvailable = this.getMenuItemAvailableInventory(item) + Math.max(1, Math.floor(delta));
    void this.updateMenuItemInventory(itemId, nextAvailable + this.getMenuItemReservedQuantity(itemId));
  }

  decreaseMenuItemAvailableInventory(itemId: number, delta: number): void {
    const item = this.menuCategories().flatMap((category) => category.items).find((entry) => entry.itemId === itemId);
    if (!item) return;
    const nextAvailable = Math.max(0, this.getMenuItemAvailableInventory(item) - Math.max(1, Math.floor(delta)));
    void this.updateMenuItemInventory(itemId, nextAvailable + this.getMenuItemReservedQuantity(itemId));
  }

  setMenuItemInventoryFromInput(itemId: number, rawValue: string): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    void this.updateMenuItemInventory(itemId, parsed);
  }

  setMenuItemAvailableInventoryFromInput(itemId: number, rawValue: string): void {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    void this.updateMenuItemInventory(itemId, Math.max(0, Math.floor(parsed)) + this.getMenuItemReservedQuantity(itemId));
  }

  isMenuItemLive(item: MenuItemCard): boolean { return item.isActive && this.getMenuItemAvailableInventory(item) > 0; }
  isMenuItemOutOfStock(item: MenuItemCard): boolean { return this.getMenuItemAvailableInventory(item) <= 0; }

  orderStatusClass(status: string): string { return status.toLowerCase(); }

  isCategoryIconImage(icon: string): boolean {
    return /^(https?:\/\/|data:image\/)/i.test((icon || '').trim());
  }

  categoryDisplayIcon(category: MenuCategoryCard): string {
    const direct = (category.categoryIcon || '').trim();
    if (direct && !this.isCategoryIconImage(direct)) return direct;

    const lower = category.categoryName.toLowerCase();
    if (lower.includes('breakfast')) return '\u{1F373}';
    if (lower.includes('main')) return '\u{1F35B}';
    if (lower.includes('snack')) return '\u{1F35F}';
    if (lower.includes('bev')) return '\u{1F964}';
    if (lower.includes('shake')) return '\u{1F964}';
    return '\u{1F37D}\uFE0F';
  }
  private async loadCitiesFromApi(): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminApi.getCities());
      if (response.success && Array.isArray(response.data)) {
        this.adminCities.set(response.data.slice().sort((a, b) => a.name.localeCompare(b.name)));
      }
    } finally {
      this.citiesLoaded = true;
    }
  }

  private async loadKitchensFromApi(): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminApi.getKitchens());
      if (response.success && Array.isArray(response.data)) {
        this.kitchenCards.set(this.applyKitchenProfiles(response.data.map((entry) => this.mapKitchenDtoToCard(entry))));
      }
    } catch {
      // use fallback
    } finally {
      this.kitchensLoaded = true;
      void this.loadDashboardOrdersFromApi();
    }
  }

  private async loadHotelsFromApi(): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminApi.getHotels());
      if (response.success && Array.isArray(response.data)) {
        this.hotelCards.set(response.data.map((entry) => this.mapHotelDtoToCard(entry)));
        if (!this.selectedMenuHotelId() && this.hotelCards().length > 0) {
          void this.selectMenuHotel(this.hotelCards()[0].hotelId);
        }
      }
    } catch {
      // use fallback
    } finally {
      this.hotelsLoaded = true;
    }
  }

  private async loadMenuFromApi(): Promise<void> {
    const hotelId = this.selectedMenuHotelId() ?? this.hotelCards()[0]?.hotelId ?? null;
    if (!hotelId) {
      this.menuCategories.set([]);
      this.menuLoaded = true;
      return;
    }
    await this.loadMenuForHotel(hotelId);
  }

  private async loadMenuForHotel(hotelId: number): Promise<void> {
    try {
      const response = await firstValueFrom(this.adminApi.getHotelMenu(hotelId));
      if (response.success && Array.isArray(response.data)) {
        this.selectedMenuHotelId.set(hotelId);
        this.menuCategories.set(response.data.map((entry) => this.mapMenuCategoryDtoToCard(entry)));
      } else {
        this.menuCategories.set([]);
      }
    } catch {
      this.menuCategories.set([]);
    } finally {
      this.menuLoaded = true;
    }
  }


  private upsertKitchenCard(card: KitchenCard, plainPassword?: string): void {
    this.kitchenCards.update((items) => {
      const existingIndex = items.findIndex((entry) => entry.kitchenId === card.kitchenId);
      const nextItems = existingIndex < 0
        ? [card, ...items]
        : items.map((entry) => entry.kitchenId === card.kitchenId ? { ...entry, ...card } : entry);

      return this.applyKitchenProfiles(nextItems, plainPassword ? { kitchenId: card.kitchenId, plainPassword } : undefined);
    });
  }

  private loadStoredKitchenProfiles(): KitchenProfile[] {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(this.kitchenProfilesStorageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((entry) => entry && typeof entry.kitchenId === 'number' && entry.loginUsername && entry.passwordHash);
    } catch {
      return [];
    }
  }

  private applyKitchenProfiles(cards: KitchenCard[], passwordUpdate?: { kitchenId: number; plainPassword: string }): KitchenCard[] {
    const profileMap = new Map(this.loadStoredKitchenProfiles().map((entry) => [entry.kitchenId, entry]));
    if (passwordUpdate) {
      const current = profileMap.get(passwordUpdate.kitchenId);
      profileMap.set(passwordUpdate.kitchenId, {
        kitchenId: passwordUpdate.kitchenId,
        loginUsername: current?.loginUsername ?? cards.find((entry) => entry.kitchenId === passwordUpdate.kitchenId)?.loginUsername ?? '',
        passwordHash: hashMockPassword(passwordUpdate.plainPassword),
        isActive: cards.find((entry) => entry.kitchenId === passwordUpdate.kitchenId)?.isActive ?? current?.isActive ?? true
      });
      this.recentKitchenPasswords.update((items) => ({ ...items, [passwordUpdate.kitchenId]: passwordUpdate.plainPassword }));
    }

    const next = cards.map((card) => {
      const stored = profileMap.get(card.kitchenId);
      const nextProfile: KitchenProfile = {
        kitchenId: card.kitchenId,
        loginUsername: card.loginUsername || stored?.loginUsername || this.generateKitchenUsername(card.name, card.kitchenId),
        passwordHash: stored?.passwordHash || '',
        isActive: card.isActive
      };
      profileMap.set(card.kitchenId, nextProfile);

      return {
        ...card,
        loginUsername: nextProfile.loginUsername,
        hasPasswordConfigured: Boolean(nextProfile.passwordHash)
      };
    });

    if (typeof window !== 'undefined') {
      localStorage.setItem(this.kitchenProfilesStorageKey, JSON.stringify(Array.from(profileMap.values())));
    }

    return next;
  }

  private generateKitchenUsername(name: string, kitchenId: number): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 10);
    return `${slug || 'kitchen'}${kitchenId}`;
  }

  private generateKitchenPassword(): string {
    return `Kitchen@${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  }

  private upsertHotelCard(card: HotelCard): void {
    this.hotelCards.update((items) => {
      const existingIndex = items.findIndex((entry) => entry.hotelId === card.hotelId);
      if (existingIndex < 0) return [card, ...items];
      const next = [...items];
      next[existingIndex] = { ...next[existingIndex], ...card };
      return next;
    });
  }

  private mapKitchenDtoToCard(dto: AdminKitchenDto): KitchenCard {
    return {
      kitchenId: dto.kitchenId,
      cityId: dto.cityId,
      cityName: dto.cityName,
      name: dto.name,
      addressLine: dto.addressLine ?? '',
      contactPhone: dto.contactPhone ?? '',
      managerName: dto.managerName ?? '',
      isActive: dto.isActive,
      hotelsCount: dto.hotelsCount,
      ordersCount: dto.ordersCount,
      revenue: dto.revenue,
      loginUsername: dto.loginUsername ?? '',
      hasPasswordConfigured: dto.hasPasswordConfigured ?? false
    };
  }

  private mapHotelDtoToCard(dto: AdminHotelDto): HotelCard {
    return {
      hotelId: dto.hotelId,
      cityId: dto.cityId,
      cityName: dto.cityName,
      kitchenId: dto.kitchenId,
      kitchenName: dto.kitchenName,
      hotelCode: dto.hotelCode,
      name: dto.name,
      addressLine: dto.addressLine ?? '',
      roomCount: dto.roomCount,
      isActive: dto.isActive,
      ordersCount: dto.ordersCount,
      revenue: dto.revenue,
      qrCodeUrl: dto.qrCodeUrl
    };
  }

  private mapMenuCategoryDtoToCard(dto: AdminMenuCategoryDto): MenuCategoryCard {
    return {
      categoryId: dto.categoryId,
      categoryName: dto.categoryName,
      categoryIcon: dto.categoryIcon ?? '',
      sortOrder: dto.sortOrder,
      items: (dto.items ?? []).map((item) => ({
        itemId: item.itemId,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description ?? '',
        price: item.price,
        isVeg: item.isVeg,
        isActive: item.isActive,
        prepTimeMinutes: item.prepTimeMinutes ?? 15,
        imageUrl: item.imageUrl ?? '',
        availableKitchenIds: item.availableKitchenIds ?? [],
        baseInventory: item.inventoryQuantity ?? 0
      }))
    };
  }

  private getFallbackKitchenCards(): KitchenCard[] {
    const managerMap: Record<number, string> = { 1: 'Ramesh Kumar', 2: 'Suresh Patel', 3: 'Rajesh Sharma', 4: 'Asha Verma' };
    return this.store.kitchens.map((kitchen) => {
      const city = this.store.cities.find((entry) => entry.id === kitchen.cityId);
      const hotelsCount = this.store.hotels.filter((hotel) => hotel.kitchenId === kitchen.id).length;
      const kitchenOrders = this.dashboardRows().filter((row) => row.kitchenId === kitchen.id);
      const ordersCount = kitchenOrders.length;
      const revenue = kitchenOrders.reduce((sum, row) => sum + row.totalAmount, 0);
      return {
        kitchenId: kitchen.id,
        cityId: kitchen.cityId,
        cityName: city?.name ?? 'Unknown',
        name: kitchen.name,
        addressLine: `${city?.name ?? 'Unknown'} Central Zone`,
        contactPhone: '9876543210',
        managerName: managerMap[kitchen.id] ?? 'Kitchen Manager',
        isActive: true,
        hotelsCount,
        ordersCount,
        revenue,
        loginUsername: '',
        hasPasswordConfigured: false
      };
    });
  }

  private getFallbackHotelCards(): HotelCard[] {
    const roomMap: Record<number, number> = { 101: 120, 102: 85, 201: 200, 301: 150 };
    return this.store.hotels.map((hotel) => {
      const cityName = this.store.cities.find((entry) => entry.id === hotel.cityId)?.name ?? 'Unknown';
      const kitchenName = this.store.kitchens.find((entry) => entry.id === hotel.kitchenId)?.name ?? 'Unknown';
      const hotelOrders = this.dashboardRows().filter((row) => row.hotelId === hotel.id);
      const ordersCount = hotelOrders.length;
      const revenue = hotelOrders.reduce((sum, row) => sum + row.totalAmount, 0);
      return {
        hotelId: hotel.id,
        cityId: hotel.cityId,
        cityName,
        kitchenId: hotel.kitchenId,
        kitchenName,
        hotelCode: hotel.code,
        name: hotel.name,
        addressLine: `${cityName} Business District`,
        roomCount: roomMap[hotel.id] ?? 100,
        isActive: true,
        ordersCount,
        revenue,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(this.getGuestRouteUrl(hotel.code))}`
      };
    });
  }
}

