import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import {
  CATEGORIES,
  CITIES,
  DUMMY_ORDERS,
  HOTELS,
  ITEMS,
  KITCHENS,
  KITCHEN_ITEM_AVAILABILITY
} from '../data/dummy-data';
import {
  CartItem,
  FoodPreference,
  Hotel,
  Item,
  MenuCategory,
  Order,
  OrderStatus,
  OtpSession
} from '../models/domain.models';

type SharedMenuItem = Item & { hotelId: number; availableKitchenIds: number[]; baseInventory: number };
type DashboardOrder = Order & { hotelName: string; serviceTimeMins: number };

@Injectable({ providedIn: 'root' })
export class MockStoreService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly ordersStorageKey = 'tx_orders_v1';
  private readonly menuStorageKey = 'tx_admin_menu_v1';
  private readonly hotelMenuStorageKey = 'tx_admin_hotel_menus_v1';

  readonly cities = CITIES;
  readonly kitchens = KITCHENS;
  readonly hotels = HOTELS;

  private readonly otpSession = signal<OtpSession | null>(null);
  private readonly currentHotelId = signal<number | null>(null);
  private readonly foodPreference = signal<FoodPreference>('All');
  private readonly cart = signal<CartItem[]>([]);
  private readonly orders = signal<Order[]>(this.loadOrders());
  private readonly menuItems = signal<SharedMenuItem[]>(this.loadMenuItems());

  readonly cartItems = computed(() =>
    this.cart()
      .map((line) => {
        const hotelId = this.currentHotelId();
        const item = this.menuItems().find((candidate) => candidate.id === line.itemId && candidate.hotelId === hotelId);
        if (!item) {
          return null;
        }
        return { ...line, item };
      })
      .filter((line): line is { itemId: number; quantity: number; item: SharedMenuItem } => Boolean(line))
  );

  readonly cartTotal = computed(() => this.cartItems().reduce((sum, line) => sum + line.item.price * line.quantity, 0));
  readonly otpVerified = computed(() => Boolean(this.otpSession()?.verified));

  constructor() {
    if (this.isBrowser) {
      window.addEventListener('storage', (event: StorageEvent) => {
        if (event.key === this.ordersStorageKey) {
          this.orders.set(this.loadOrders());
          return;
        }

        if (event.key === this.menuStorageKey || event.key === this.hotelMenuStorageKey) {
          this.menuItems.set(this.loadMenuItems());
        }
      });
    }

    effect(() => {
      const snapshot = this.orders();
      if (!this.isBrowser) {
        return;
      }

      localStorage.setItem(this.ordersStorageKey, JSON.stringify(snapshot));
    });
  }

  setHotelByCode(code: string): Hotel | null {
    const hotel = this.hotels.find((candidate) => candidate.code === code) ?? null;
    this.currentHotelId.set(hotel?.id ?? null);
    this.cart.set([]);
    this.foodPreference.set('All');
    this.otpSession.set(null);
    return hotel;
  }

  getHotelContext(hotelId: number): { cityName: string; kitchenName: string } {
    const hotel = this.hotels.find((candidate) => candidate.id === hotelId);
    if (!hotel) {
      return { cityName: '-', kitchenName: '-' };
    }

    const cityName = this.cities.find((city) => city.id === hotel.cityId)?.name ?? '-';
    const kitchenName = this.kitchens.find((kitchen) => kitchen.id === hotel.kitchenId)?.name ?? '-';

    return { cityName, kitchenName };
  }

  setFoodPreference(value: FoodPreference): void {
    this.foodPreference.set(value);
  }

  getFoodPreference(): FoodPreference {
    return this.foodPreference();
  }

  sendOtp(mobile: string): OtpSession {
    const session: OtpSession = {
      mobile,
      otp: '123456',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      verified: false
    };

    this.otpSession.set(session);
    return session;
  }

  verifyOtp(otp: string): boolean {
    const current = this.otpSession();
    if (!current) {
      return false;
    }

    const isExpired = new Date(current.expiresAt).getTime() < Date.now();
    if (isExpired || current.otp !== otp) {
      return false;
    }

    this.otpSession.set({ ...current, verified: true });
    return true;
  }

  getMenuByCurrentHotel(): MenuCategory[] {
    const hotelId = this.currentHotelId();
    const preference = this.foodPreference();
    if (!hotelId) {
      return [];
    }

    const hotel = this.hotels.find((candidate) => candidate.id === hotelId);
    if (!hotel) {
      return [];
    }

    const filteredItems = this.menuItems().filter((item) => {
      const byKitchen = item.hotelId === hotel.id && item.active && item.availableKitchenIds.includes(hotel.kitchenId) && this.getAvailableInventory(item.id, hotel.id) > 0;
      if (preference === 'Veg') {
        return byKitchen && item.isVeg;
      }
      if (preference === 'NonVeg') {
        return byKitchen && !item.isVeg;
      }
      return byKitchen;
    });

    return [...CATEGORIES]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((category) => ({
        category,
        items: filteredItems.filter((item) => item.categoryId === category.id)
      }))
      .filter((entry) => entry.items.length > 0);
  }

  addToCart(itemId: number): void {
    const available = this.getAvailableInventory(itemId, this.currentHotelId() ?? undefined);
    const current = [...this.cart()];
    const existing = current.find((line) => line.itemId === itemId);
    const currentQty = existing?.quantity ?? 0;

    if (currentQty >= available) {
      return;
    }

    if (existing) {
      existing.quantity += 1;
    } else {
      current.push({ itemId, quantity: 1 });
    }

    this.cart.set(current);
  }

  updateCartQuantity(itemId: number, quantity: number): void {
    const boundedQuantity = Math.min(Math.max(0, quantity), this.getAvailableInventory(itemId, this.currentHotelId() ?? undefined));
    if (boundedQuantity <= 0) {
      this.cart.set(this.cart().filter((line) => line.itemId !== itemId));
      return;
    }

    this.cart.set(
      this.cart().map((line) => {
        if (line.itemId === itemId) {
          return { ...line, quantity: boundedQuantity };
        }
        return line;
      })
    );
  }

  placeCodOrder(roomNumber?: string): { success: boolean; message: string; order?: Order } {
    const session = this.otpSession();
    const hotelId = this.currentHotelId();

    if (!session?.verified || !hotelId) {
      return { success: false, message: 'OTP verification required before placing COD order.' };
    }

    if (this.cart().length === 0) {
      return { success: false, message: 'Add at least one item before checkout.' };
    }

    const hotel = this.hotels.find((candidate) => candidate.id === hotelId);
    if (!hotel) {
      return { success: false, message: 'Hotel mapping not found.' };
    }

    const invalidLine = this.cart().find((line) => line.quantity > this.getAvailableInventory(line.itemId, hotelId));
    if (invalidLine) {
      return { success: false, message: 'One or more items are no longer available in requested quantity.' };
    }

    const now = new Date().toISOString();
    const nextId = Math.max(0, ...this.orders().map((order) => order.id)) + 1;
    const lines = this.cart()
      .map((line) => {
        const hotelId = this.currentHotelId();
        const item = this.menuItems().find((candidate) => candidate.id === line.itemId && candidate.hotelId === hotelId);
        if (!item) {
          return null;
        }

        return {
          itemId: line.itemId,
          quantity: line.quantity,
          unitPrice: item.price
        };
      })
      .filter((line): line is { itemId: number; quantity: number; unitPrice: number } => Boolean(line));

    if (lines.length === 0) {
      return { success: false, message: 'Cart has invalid items.' };
    }

    const order: Order = {
      id: nextId,
      orderNo: `TX-${10000 + nextId}`,
      hotelId,
      kitchenId: hotel.kitchenId,
      mobile: session.mobile,
      roomNumber: roomNumber?.trim() || undefined,
      lines,
      totalAmount: this.cartTotal(),
      paymentMethod: 'COD',
      paymentStatus: 'Pending',
      status: 'Accepted',
      createdAt: now,
      updatedAt: now
    };

    this.orders.set([order, ...this.orders()]);
    this.cart.set([]);

    return {
      success: true,
      message: `COD order ${order.orderNo} placed successfully. Please pay on delivery.`,
      order
    };
  }

  getAvailableInventory(itemId: number, hotelId?: number): number {
    const targetHotelId = hotelId ?? this.currentHotelId();
    if (!targetHotelId) {
      return 0;
    }

    const item = this.menuItems().find((entry) => entry.id === itemId && entry.hotelId === targetHotelId);
    if (!item) {
      return 0;
    }

    const reservedQty = this.orders()
      .filter((order) => order.status !== 'Rejected' && order.hotelId === targetHotelId)
      .flatMap((order) => order.lines)
      .filter((line) => line.itemId === itemId)
      .reduce((sum, line) => sum + line.quantity, 0);

    return Math.max(0, item.baseInventory - reservedQty);
  }

  getDashboardOrders(hotelId?: number): DashboardOrder[] {
    const activeOrders = this.orders().filter((order) => order.paymentStatus !== 'Failed');

    return activeOrders
      .filter((order) => (hotelId ? order.hotelId === hotelId : true))
      .map((order) => {
        const hotelName = this.hotels.find((hotel) => hotel.id === order.hotelId)?.name ?? 'Unknown Hotel';
        const serviceTimeMins = Math.max(1, Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000));

        return {
          ...order,
          hotelName,
          serviceTimeMins
        };
      });
  }

  updateOrderStatus(orderId: number, status: OrderStatus, rejectionReason?: string): void {
    this.orders.set(
      this.orders().map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        const now = new Date().toISOString();
        const acceptedAt =
          status === 'Accepted'
            ? now
            : status === 'Preparing' || status === 'Ready' || status === 'Delivered'
              ? order.acceptedAt ?? now
              : order.acceptedAt;

        const preparingStartedAt =
          status === 'Preparing'
            ? now
            : status === 'Ready' || status === 'Delivered'
              ? order.preparingStartedAt ?? now
              : order.preparingStartedAt;

        const readyAt =
          status === 'Ready'
            ? now
            : status === 'Delivered'
              ? order.readyAt ?? now
              : order.readyAt;

        return {
          ...order,
          status,
          updatedAt: now,
          acceptedAt,
          preparingStartedAt,
          readyAt,
          deliveredAt: status === 'Delivered' ? now : order.deliveredAt,
          rejectedAt: status === 'Rejected' ? now : order.rejectedAt,
          rejectionReason: status === 'Rejected' ? rejectionReason : order.rejectionReason
        };
      })
    );
  }

  rejectOrder(orderId: number, reason: string): { success: boolean; message: string; mobile?: string } {
    const order = this.orders().find((entry) => entry.id === orderId);
    if (!order) {
      return { success: false, message: 'Order not found.' };
    }

    this.updateOrderStatus(orderId, 'Rejected', reason);

    return {
      success: true,
      message: `Rejection SMS sent to +91 ${order.mobile}`,
      mobile: order.mobile
    };
  }

  private loadMenuItems(): SharedMenuItem[] {
    const fallback = this.hotels.flatMap((hotel) => ITEMS
      .map((item) => ({
        ...item,
        hotelId: hotel.id,
        availableKitchenIds: KITCHEN_ITEM_AVAILABILITY.filter((entry) => entry.itemId === item.id && entry.isAvailable && entry.kitchenId === hotel.kitchenId).map((entry) => entry.kitchenId),
        baseInventory: 50
      }))
      .filter((item) => item.availableKitchenIds.length > 0)
    );

    if (!this.isBrowser) {
      return fallback;
    }

    try {
      const hotelRaw = localStorage.getItem(this.hotelMenuStorageKey);
      if (hotelRaw) {
        const parsed = JSON.parse(hotelRaw);
        if (parsed && typeof parsed === 'object') {
          const flattened = Object.entries(parsed).flatMap(([hotelId, categories]) => Array.isArray(categories)
            ? (categories as Array<{ items?: Array<{ itemId: number; categoryId: number; name: string; description: string; price: number; isVeg: boolean; isActive: boolean; availableKitchenIds?: number[]; baseInventory?: number }> }>).flatMap((category) => Array.isArray(category.items)
                ? category.items.map((item) => ({
                    id: item.itemId,
                    categoryId: item.categoryId,
                    hotelId: Number(hotelId),
                    name: item.name,
                    description: item.description,
                    price: item.price,
                    isVeg: item.isVeg,
                    active: item.isActive,
                    availableKitchenIds: item.availableKitchenIds ?? [],
                    baseInventory: item.baseInventory ?? 0
                  }))
                : [])
            : []);

          if (flattened.length > 0) {
            return flattened;
          }
        }
      }

      const raw = localStorage.getItem(this.menuStorageKey);
      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return fallback;
      }

      return this.hotels.flatMap((hotel) => {
        const hotelItems = parsed.flatMap((category: { items?: Array<{ itemId: number; categoryId: number; name: string; description: string; price: number; isVeg: boolean; isActive: boolean; availableKitchenIds?: number[]; baseInventory?: number }> }) => Array.isArray(category.items)
          ? category.items.map((item: { itemId: number; categoryId: number; name: string; description: string; price: number; isVeg: boolean; isActive: boolean; availableKitchenIds?: number[]; baseInventory?: number }) => ({
              id: item.itemId,
              categoryId: item.categoryId,
              hotelId: hotel.id,
              name: item.name,
              description: item.description,
              price: item.price,
              isVeg: item.isVeg,
              active: item.isActive,
              availableKitchenIds: (item.availableKitchenIds ?? []).filter((kitchenId) => kitchenId === hotel.kitchenId),
              baseInventory: item.baseInventory ?? 0
            }))
          : []);

        return hotelItems.filter((item) => item.availableKitchenIds.length > 0);
      });
    } catch {
      return fallback;
    }
  }

  private loadOrders(): Order[] {
    if (!this.isBrowser) {
      return [...DUMMY_ORDERS];
    }

    try {
      const raw = localStorage.getItem(this.ordersStorageKey);
      if (!raw) {
        return [...DUMMY_ORDERS];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [...DUMMY_ORDERS];
      }

      return parsed as Order[];
    } catch {
      return [...DUMMY_ORDERS];
    }
  }
}





