import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

interface ApiError {
  code?: string;
  message?: string;
  validationErrors?: Record<string, string[]>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: ApiError | null;
}

export interface GuestMenuItemDto {
  itemId: number;
  itemCode: string;
  name: string;
  description?: string | null;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
}

export interface GuestMenuCategoryDto {
  categoryId: number;
  categoryName: string;
  sortOrder: number;
  items: GuestMenuItemDto[];
}

export interface HotelMenuResponseDto {
  hotelId: number;
  hotelCode: string;
  hotelName: string;
  cityId: number;
  cityName: string;
  kitchenId: number;
  kitchenName: string;
  categories: GuestMenuCategoryDto[];
}

export interface SendOtpRequest {
  mobileNumber: string;
  hotelCode: string;
  purpose?: number;
}

export interface SendOtpResponse {
  otpSessionId: string;
  expiresAtUtc: string;
  expiresInSeconds: number;
  isRateLimited: boolean;
  remainingAttempts: number;
}

export interface VerifyOtpRequest {
  otpSessionId: string;
  mobileNumber: string;
  otpCode: string;
}

export interface VerifyOtpResponse {
  verified: boolean;
  guestSessionToken: string;
  sessionExpiresAtUtc: string;
}

export interface CheckoutRequest {
  guestSessionToken: string;
  hotelCode: string;
  currencyCode: string;
  paymentMethod: number;
  lines: Array<{ itemId: number; quantity: number }>;
  guestNotes?: string;
  clientOrderRef: string;
}

export interface CheckoutResponse {
  orderId: number;
  orderNumber: string;
  hotelId: number;
  kitchenId: number;
  totalAmount: number;
  currencyCode: string;
  paymentMethod: number;
  createdAtUtc: string;
  lines: Array<{ itemId: number; itemName: string; quantity: number; unitPrice: number; lineTotal: number }>;
}

@Injectable({ providedIn: 'root' })
export class GuestApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/guest';

  getHotelMenu(hotelCode: string): Observable<ApiResponse<HotelMenuResponseDto>> {
    return this.http.get<ApiResponse<HotelMenuResponseDto>>(`${this.baseUrl}/hotels/${encodeURIComponent(hotelCode)}/menu`);
  }

  sendOtp(request: SendOtpRequest): Observable<ApiResponse<SendOtpResponse>> {
    return this.http.post<ApiResponse<SendOtpResponse>>(`${this.baseUrl}/otp/send`, request);
  }

  verifyOtp(request: VerifyOtpRequest): Observable<ApiResponse<VerifyOtpResponse>> {
    return this.http.post<ApiResponse<VerifyOtpResponse>>(`${this.baseUrl}/otp/verify`, request);
  }

  checkout(request: CheckoutRequest): Observable<ApiResponse<CheckoutResponse>> {
    return this.http.post<ApiResponse<CheckoutResponse>>(`${this.baseUrl}/checkout`, request);
  }
}
