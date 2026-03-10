import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { GuestApiService } from '../../services/guest-api.service';

type FoodPreference = 'All' | 'Veg' | 'NonVeg';

interface GuestHotelView {
  id: number;
  code: string;
  name: string;
  cityName: string;
  kitchenName: string;
}

interface MenuItemView {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  active: boolean;
}

interface MenuSectionView {
  category: { id: number; name: string; sortOrder: number };
  items: MenuItemView[];
}

interface CartLineView {
  itemId: number;
  quantity: number;
  item: MenuItemView;
}

@Component({
  selector: 'app-guest-order',
  imports: [CommonModule, FormsModule, ButtonModule, MessageModule],
  templateUrl: './guest-order.component.html',
  styleUrl: './guest-order.component.scss'
})
export class GuestOrderComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly guestApi = inject(GuestApiService);

  hotel = signal<GuestHotelView | null>(null);
  roomNumber = signal('');
  mobile = signal('');
  searchTerm = signal('');

  checkoutMessage = signal('');
  checkoutSuccess = signal(false);

  currentStep = signal<1 | 2 | 3>(1);
  otpDigits = signal<string[]>(['', '', '', '', '', '']);
  otpHint = signal('');
  otpError = signal('');
  roomError = signal('');
  mobileError = signal('');
  remainingSeconds = signal(0);
  verified = signal(false);
  showCart = signal(false);
  showPayment = signal(false);
  showOrderPlaced = signal(false);
  collapsedCategories = signal<Set<number>>(new Set());

  private readonly hotelCode = signal('');
  private readonly otpSessionId = signal<string | null>(null);
  private readonly guestSessionToken = signal<string | null>(null);
  private readonly selectedPreferenceState = signal<FoodPreference>('All');
  private readonly menuSections = signal<MenuSectionView[]>([]);
  private readonly cartLines = signal<CartLineView[]>([]);

  private timer: ReturnType<typeof setInterval> | null = null;
  private orderPlacedTimer: ReturnType<typeof setTimeout> | null = null;

  readonly cartItems = computed(() => this.cartLines());
  readonly cartTotal = computed(() => this.cartLines().reduce((sum, line) => sum + (line.item.price * line.quantity), 0));
  readonly cartItemCount = computed(() => this.cartItems().reduce((sum, line) => sum + line.quantity, 0));
  readonly gstAmount = computed(() => Math.round(this.cartTotal() * 0.18));
  readonly payableTotal = computed(() => this.cartTotal() + this.gstAmount());
  readonly selectedPreference = computed(() => this.selectedPreferenceState());
  readonly showMenu = computed(() => this.verified());

  readonly hotelContext = computed(() => {
    const selectedHotel = this.hotel();
    if (!selectedHotel) {
      return { cityName: '-', kitchenName: '-' };
    }
    return { cityName: selectedHotel.cityName, kitchenName: selectedHotel.kitchenName };
  });

  readonly timerText = computed(() => {
    const total = Math.max(0, this.remainingSeconds());
    const min = Math.floor(total / 60);
    const sec = total % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  });

  readonly filteredMenu = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    const preference = this.selectedPreferenceState();

    const sections = this.menuSections().map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (preference === 'Veg' && !item.isVeg) {
          return false;
        }
        if (preference === 'NonVeg' && item.isVeg) {
          return false;
        }
        if (!query) {
          return true;
        }
        return item.name.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);
      })
    }));

    return query ? sections.filter((section) => section.items.length > 0) : sections;
  });

  private readonly itemMap = computed(() => {
    const map = new Map<number, MenuItemView>();
    this.menuSections().forEach((section) => section.items.forEach((item) => map.set(item.id, item)));
    return map;
  });

  private readonly etaByItemId: Record<number, string> = {
    1001: '~10 min',
    1002: '~12 min',
    2001: '~20 min',
    2002: '~22 min',
    2003: '~25 min',
    3001: '~8 min',
    3002: '~14 min',
    4001: '~6 min',
    4002: '~7 min'
  };

  private readonly imageByItemId: Record<number, string> = {
    1001: 'https://picsum.photos/id/1080/140/100',
    1002: 'https://picsum.photos/id/292/140/100',
    2001: 'https://picsum.photos/id/431/140/100',
    2002: 'https://picsum.photos/id/312/140/100',
    2003: 'https://picsum.photos/id/237/140/100',
    3001: 'https://picsum.photos/id/1060/140/100',
    3002: 'https://picsum.photos/id/102/140/100',
    4001: 'https://picsum.photos/id/225/140/100',
    4002: 'https://picsum.photos/id/823/140/100'
  };

  constructor() {
    const code = this.route.snapshot.paramMap.get('hotelCode') ?? '';
    this.hotelCode.set(code);
    void this.loadHotelMenu();
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    if (this.orderPlacedTimer) {
      clearTimeout(this.orderPlacedTimer);
    }
  }

  stepDone(step: 1 | 2 | 3): boolean {
    return this.currentStep() > step || (step === 3 && this.verified());
  }

  continueToMobile(): void {
    this.roomError.set('');

    if (!this.roomNumber().trim()) {
      this.roomError.set('Please enter room number.');
      return;
    }

    this.currentStep.set(2);
  }

  async sendOtp(): Promise<void> {
    this.mobileError.set('');
    this.otpError.set('');

    const mobile = this.mobile().trim();
    if (!/^\d{10}$/.test(mobile)) {
      this.mobileError.set('Please enter valid 10-digit mobile number.');
      return;
    }

    try {
      const response = await firstValueFrom(this.guestApi.sendOtp({
        mobileNumber: mobile,
        hotelCode: this.hotelCode(),
        purpose: 1
      }));

      if (!response.success || !response.data) {
        this.mobileError.set(response.error?.message?.trim() || 'Unable to send OTP.');
        return;
      }

      this.otpSessionId.set(response.data.otpSessionId);
      this.otpHint.set('OTP sent to your mobile number.');
      this.currentStep.set(3);
      this.otpDigits.set(['', '', '', '', '', '']);

      const end = new Date(response.data.expiresAtUtc).getTime();
      this.startTimer(end);
    } catch (error) {
      this.mobileError.set(this.extractApiError(error, 'Unable to send OTP.'));
    }
  }

  onOtpInput(index: number, value: string): void {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...this.otpDigits()];
    next[index] = digit;
    this.otpDigits.set(next);
    this.otpError.set('');
  }

  async verifyOtp(): Promise<void> {
    const otp = this.otpDigits().join('');

    if (otp.length !== 6) {
      this.otpError.set('Please enter 6-digit OTP.');
      return;
    }

    const sessionId = this.otpSessionId();
    if (!sessionId) {
      this.otpError.set('OTP session not found. Please resend OTP.');
      return;
    }

    try {
      const response = await firstValueFrom(this.guestApi.verifyOtp({
        otpSessionId: sessionId,
        mobileNumber: this.mobile().trim(),
        otpCode: otp
      }));

      if (!response.success || !response.data || !response.data.verified) {
        this.otpError.set(response.error?.message?.trim() || 'Invalid or expired OTP.');
        return;
      }

      this.guestSessionToken.set(response.data.guestSessionToken);
      this.verified.set(true);
      this.checkoutMessage.set('');
      await this.loadHotelMenu();
    } catch (error) {
      this.otpError.set(this.extractApiError(error, 'Invalid or expired OTP.'));
    }
  }

  setPreference(preference: FoodPreference): void {
    this.selectedPreferenceState.set(preference);
  }

  addToCart(itemId: number): void {
    const item = this.itemMap().get(itemId);
    if (!item || !item.active) {
      return;
    }

    this.cartLines.update((lines) => {
      const index = lines.findIndex((line) => line.itemId === itemId);
      if (index < 0) {
        return [...lines, { itemId, quantity: 1, item }];
      }
      const next = [...lines];
      next[index] = { ...next[index], quantity: next[index].quantity + 1 };
      return next;
    });
  }

  cartQuantity(itemId: number): number {
    return this.cartItems().find((line) => line.itemId === itemId)?.quantity ?? 0;
  }

  increaseQuantity(itemId: number): void {
    this.addToCart(itemId);
  }

  decreaseQuantity(itemId: number): void {
    const current = this.cartQuantity(itemId);
    this.updateCartQuantity(itemId, current - 1);
  }

  removeFromCart(itemId: number): void {
    this.updateCartQuantity(itemId, 0);
  }

  clearCart(): void {
    this.cartLines.set([]);
    this.showOrderPlaced.set(false);
    this.showPayment.set(false);
    this.showCart.set(false);
  }

  openCart(): void {
    if (this.cartItemCount() > 0) {
      this.showOrderPlaced.set(false);
      this.showPayment.set(false);
      this.showCart.set(true);
    }
  }

  backToMenu(): void {
    this.showOrderPlaced.set(false);
    this.showPayment.set(false);
    this.showCart.set(false);
  }

  openPayment(): void {
    if (this.cartItemCount() > 0) {
      this.showOrderPlaced.set(false);
      this.showPayment.set(true);
    }
  }

  backToCart(): void {
    this.showPayment.set(false);
  }

  lineTotal(itemId: number): number {
    const line = this.cartItems().find((entry) => entry.itemId === itemId);
    if (!line) {
      return 0;
    }
    return line.item.price * line.quantity;
  }

  itemEta(itemId: number): string {
    return this.etaByItemId[itemId] ?? '~15 min';
  }

  itemImage(itemId: number): string {
    return this.imageByItemId[itemId] ?? `https://picsum.photos/seed/${itemId}/140/100`;
  }

  vegText(item: MenuItemView): string {
    return item.isVeg ? 'veg' : 'non-veg';
  }

  isCategoryOpen(categoryId: number): boolean {
    return !this.collapsedCategories().has(categoryId);
  }

  toggleCategory(categoryId: number): void {
    const next = new Set(this.collapsedCategories());
    if (next.has(categoryId)) {
      next.delete(categoryId);
    } else {
      next.add(categoryId);
    }
    this.collapsedCategories.set(next);
  }

  async placeOrder(): Promise<void> {
    const token = this.guestSessionToken();
    if (!token) {
      this.checkoutSuccess.set(false);
      this.checkoutMessage.set('Session expired. Please verify mobile number again.');
      return;
    }

    const lines = this.cartItems().map((line) => ({ itemId: line.itemId, quantity: line.quantity }));
    if (lines.length === 0) {
      this.checkoutSuccess.set(false);
      this.checkoutMessage.set('Add at least one item before checkout.');
      return;
    }

    try {
      const response = await firstValueFrom(this.guestApi.checkout({
        guestSessionToken: token,
        hotelCode: this.hotelCode(),
        currencyCode: 'INR',
        paymentMethod: 1,
        lines,
        guestNotes: `Room ${this.roomNumber().trim()}`,
        clientOrderRef: `UI-${Date.now()}`
      }));

      if (!response.success || !response.data) {
        this.checkoutSuccess.set(false);
        this.checkoutMessage.set(response.error?.message?.trim() || 'Unable to place order.');
        return;
      }

      this.checkoutSuccess.set(true);
      this.checkoutMessage.set('Order placed successfully.');
      this.showOrderPlaced.set(true);
      this.showPayment.set(false);
      this.showCart.set(false);
      this.cartLines.set([]);

      await this.loadHotelMenu();

      if (this.orderPlacedTimer) {
        clearTimeout(this.orderPlacedTimer);
      }

      this.orderPlacedTimer = setTimeout(() => {
        this.showOrderPlaced.set(false);
        this.showPayment.set(false);
        this.showCart.set(false);
      }, 2500);
    } catch (error) {
      this.checkoutSuccess.set(false);
      this.checkoutMessage.set(this.extractApiError(error, 'Unable to place order.'));
    }
  }

  private updateCartQuantity(itemId: number, quantity: number): void {
    this.cartLines.update((lines) => {
      if (quantity <= 0) {
        return lines.filter((line) => line.itemId !== itemId);
      }
      return lines.map((line) => (line.itemId === itemId ? { ...line, quantity } : line));
    });
  }

  private async loadHotelMenu(): Promise<void> {
    const code = this.hotelCode();
    if (!code) {
      this.hotel.set(null);
      this.menuSections.set([]);
      return;
    }

    try {
      const response = await firstValueFrom(this.guestApi.getHotelMenu(code));
      if (!response.success || !response.data) {
        this.checkoutSuccess.set(false);
        this.checkoutMessage.set(response.error?.message?.trim() || 'Unable to load menu.');
        this.hotel.set(null);
        this.menuSections.set([]);
        return;
      }

      const payload = response.data;
      this.hotel.set({
        id: payload.hotelId,
        code: payload.hotelCode,
        name: payload.hotelName,
        cityName: payload.cityName,
        kitchenName: payload.kitchenName
      });

      const sections: MenuSectionView[] = payload.categories
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.categoryName.localeCompare(b.categoryName))
        .map((category) => ({
          category: {
            id: category.categoryId,
            name: category.categoryName,
            sortOrder: category.sortOrder
          },
          items: category.items
            .filter((item) => item.isAvailable)
            .map((item) => ({
              id: item.itemId,
              categoryId: category.categoryId,
              name: item.name,
              description: item.description?.trim() || 'Chef special',
              price: item.price,
              isVeg: item.isVeg,
              active: item.isAvailable
            }))
        }));

      this.menuSections.set(sections);

      const activeIds = new Set(sections.flatMap((section) => section.items.map((item) => item.id)));
      this.cartLines.update((lines) => lines.filter((line) => activeIds.has(line.itemId)));
    } catch (error) {
      this.checkoutSuccess.set(false);
      this.checkoutMessage.set(this.extractApiError(error, 'Unable to load menu.'));
      this.hotel.set(null);
      this.menuSections.set([]);
    }
  }

  private extractApiError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as {
        error?: { message?: string; validationErrors?: Record<string, string[]> } | null;
        message?: string;
        title?: string;
        errors?: string[] | Record<string, string[]>;
      } | string | null;

      if (typeof payload === 'string' && payload.trim()) {
        return payload;
      }

      if (payload && typeof payload === 'object') {
        if (payload.error?.message?.trim()) {
          return payload.error.message;
        }
        if (typeof payload.message === 'string' && payload.message.trim()) {
          return payload.message;
        }
        if (typeof payload.title === 'string' && payload.title.trim()) {
          return payload.title;
        }
        if (Array.isArray(payload.errors)) {
          const first = payload.errors.find((entry) => typeof entry === 'string' && entry.trim());
          if (first) {
            return first;
          }
        }
        if (payload.errors && typeof payload.errors === 'object' && !Array.isArray(payload.errors)) {
          const first = Object.values(payload.errors).flat().find((entry) => typeof entry === 'string' && entry.trim());
          if (first) {
            return first;
          }
        }
      }

      if (error.status === 0) {
        return 'API request failed. Ensure backend is running.';
      }

      return `Request failed (${error.status}).`;
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  private startTimer(endTime: number): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    const tick = (): void => {
      const diff = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      this.remainingSeconds.set(diff);

      if (diff <= 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };

    tick();
    this.timer = setInterval(tick, 1000);
  }
}


