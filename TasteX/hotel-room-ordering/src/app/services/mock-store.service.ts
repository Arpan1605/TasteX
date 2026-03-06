import { Injectable, computed, signal } from '@angular/core';
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
  MenuCategory,
  Order,
  OrderStatus,
  OtpSession
} from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class MockStoreService {
  readonly cities = CITIES;
  readonly kitchens = KITCHENS;
  readonly hotels = HOTELS;

  private readonly otpSession = signal<OtpSession | null>(null);
  private readonly currentHotelId = signal<number | null>(null);
  private readonly foodPreference = signal<FoodPreference>('All');
  private readonly cart = signal<CartItem[]>([]);
  private readonly orders = signal<Order[]>([...DUMMY_ORDERS]);

  readonly cartItems = computed(() => {
    return this.cart()
      .map((line) => {
        const item = ITEMS.find((candidate) => candidate.id === line.itemId);
        if (!item) {
          return null;
        }
        return { ...line, item };
      })
      .filter((line): line is { itemId: number; quantity: number; item: (typeof ITEMS)[number] } => Boolean(line));
  });

  readonly cartTotal = computed(() => {
    return this.cartItems().reduce((sum, line) => sum + line.item.price * line.quantity, 0);
  });

  readonly otpVerified = computed(() => Boolean(this.otpSession()?.verified));

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

    const availableItemIds = new Set(
      KITCHEN_ITEM_AVAILABILITY.filter((entry) => entry.kitchenId === hotel.kitchenId && entry.isAvailable).map((entry) => entry.itemId)
    );

    const filteredItems = ITEMS.filter((item) => {
      const byKitchen = item.active && availableItemIds.has(item.id);
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
      .map((category) => {
        return {
          category,
          items: filteredItems.filter((item) => item.categoryId === category.id)
        };
      })
      .filter((entry) => entry.items.length > 0);
  }

  addToCart(itemId: number): void {
    const current = [...this.cart()];
    const existing = current.find((line) => line.itemId === itemId);

    if (existing) {
      existing.quantity += 1;
    } else {
      current.push({ itemId, quantity: 1 });
    }

    this.cart.set(current);
  }

  updateCartQuantity(itemId: number, quantity: number): void {
    if (quantity <= 0) {
      this.cart.set(this.cart().filter((line) => line.itemId !== itemId));
      return;
    }

    this.cart.set(
      this.cart().map((line) => {
        if (line.itemId === itemId) {
          return { ...line, quantity };
        }
        return line;
      })
    );
  }

  placeCodOrder(): { success: boolean; message: string; order?: Order } {
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

    const now = new Date().toISOString();
    const nextId = Math.max(0, ...this.orders().map((order) => order.id)) + 1;
    const lines = this.cart()
      .map((line) => {
        const item = ITEMS.find((candidate) => candidate.id === line.itemId);
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

  getDashboardOrders(hotelId?: number): Array<Order & { hotelName: string; serviceTimeMins: number }> {
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

  updateOrderStatus(orderId: number, status: OrderStatus): void {
    this.orders.set(
      this.orders().map((order) => {
        if (order.id !== orderId) {
          return order;
        }

        return {
          ...order,
          status,
          updatedAt: new Date().toISOString()
        };
      })
    );
  }
}
