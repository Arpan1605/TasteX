import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SelectButtonModule } from 'primeng/selectbutton';
import { AccordionModule } from 'primeng/accordion';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { MockStoreService } from '../../services/mock-store.service';
import { FoodPreference, Hotel } from '../../models/domain.models';

@Component({
  selector: 'app-guest-order',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CardModule,
    InputTextModule,
    ButtonModule,
    MessageModule,
    SelectButtonModule,
    AccordionModule,
    TagModule,
    DividerModule
  ],
  templateUrl: './guest-order.component.html',
  styleUrl: './guest-order.component.scss'
})
export class GuestOrderComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(MockStoreService);

  hotel = signal<Hotel | null>(null);
  mobile = signal('');
  otp = signal('');
  otpHint = signal('');
  otpError = signal('');
  checkoutMessage = signal('');
  checkoutSuccess = signal(false);

  readonly preferenceOptions = [
    { label: 'All', value: 'All' },
    { label: 'Veg', value: 'Veg' },
    { label: 'Non-Veg', value: 'NonVeg' }
  ];

  readonly menu = computed(() => this.store.getMenuByCurrentHotel());
  readonly cartItems = this.store.cartItems;
  readonly cartTotal = this.store.cartTotal;
  readonly otpVerified = this.store.otpVerified;
  readonly selectedPreference = computed(() => this.store.getFoodPreference());
  readonly hotelContext = computed(() => {
    const selectedHotel = this.hotel();
    if (!selectedHotel) {
      return { cityName: '-', kitchenName: '-' };
    }
    return this.store.getHotelContext(selectedHotel.id);
  });

  constructor() {
    const code = this.route.snapshot.paramMap.get('hotelCode') ?? '';
    this.hotel.set(this.store.setHotelByCode(code));
  }

  sendOtp(): void {
    this.otpError.set('');
    const mobile = this.mobile().trim();

    if (!/^\d{10}$/.test(mobile)) {
      this.otpError.set('Enter a valid 10-digit mobile number.');
      return;
    }

    const session = this.store.sendOtp(mobile);
    this.otpHint.set(`Demo OTP: ${session.otp} (valid for 5 minutes)`);
  }

  verifyOtp(): void {
    this.otpError.set('');
    const isValid = this.store.verifyOtp(this.otp().trim());

    if (!isValid) {
      this.otpError.set('Invalid or expired OTP. Please request a new OTP.');
    }
  }

  setPreference(preference: FoodPreference): void {
    this.store.setFoodPreference(preference);
  }

  addToCart(itemId: number): void {
    this.store.addToCart(itemId);
  }

  increase(itemId: number, quantity: number): void {
    this.store.updateCartQuantity(itemId, quantity + 1);
  }

  decrease(itemId: number, quantity: number): void {
    this.store.updateCartQuantity(itemId, quantity - 1);
  }

  checkout(): void {
    const result = this.store.placeCodOrder();
    this.checkoutSuccess.set(result.success);
    this.checkoutMessage.set(result.message);
  }
}

