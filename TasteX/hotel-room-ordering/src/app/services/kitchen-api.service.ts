import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
}

export interface KitchenLoginRequest {
  username: string;
  password: string;
}

export interface KitchenLoginResponse {
  kitchenId: number;
  kitchenName: string;
  loginUsername: string;
  cityName: string;
  isActive: boolean;
}

export interface KitchenOrderLineDto {
  itemId: number;
  itemName: string;
  isVeg: boolean;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface KitchenOrderDto {
  orderId: number;
  orderNumber: string;
  hotelId: number;
  hotelName: string;
  hotelCode: string;
  maskedMobileNumber: string;
  mobileNumber?: string | null;
  roomNumber?: string | null;
  paymentMethod: number | string;
  paymentStatus: number | string;
  orderStatus: number | string;
  createdAtUtc: string;
  updatedAtUtc: string;
  serviceTimeMinutes: number;
  totalAmount: number;
  currencyCode: string;
  lines: KitchenOrderLineDto[];
}

export interface KitchenOrdersResponse {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  orders: KitchenOrderDto[];
}

export interface KitchenOrdersQuery {
  kitchenId: number;
  hotelId?: number;
  fromUtc?: string;
  toUtc?: string;
  pageNumber?: number;
  pageSize?: number;
}

export interface UpdateOrderStatusRequest {
  orderId: number;
  newStatus: number | string;
  updatedBy: string;
  notes?: string;
}

export interface UpdateOrderStatusResponse {
  orderId: number;
  orderNumber: string;
  previousStatus: number | string;
  currentStatus: number | string;
  updatedAtUtc: string;
}

@Injectable({ providedIn: 'root' })
export class KitchenApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${API_BASE_URL}/api/v1/kitchen`;

  login(request: KitchenLoginRequest): Observable<ApiResponse<KitchenLoginResponse>> {
    return this.http.post<ApiResponse<KitchenLoginResponse>>(`${this.baseUrl}/login`, request);
  }

  getOrders(query: KitchenOrdersQuery): Observable<ApiResponse<KitchenOrdersResponse>> {
    let params = new HttpParams().set('kitchenId', String(query.kitchenId));

    if (typeof query.hotelId === 'number' && Number.isFinite(query.hotelId)) {
      params = params.set('hotelId', String(query.hotelId));
    }
    if (query.fromUtc) {
      params = params.set('fromUtc', query.fromUtc);
    }
    if (query.toUtc) {
      params = params.set('toUtc', query.toUtc);
    }

    params = params
      .set('pageNumber', String(query.pageNumber ?? 1))
      .set('pageSize', String(query.pageSize ?? 200));

    return this.http.get<ApiResponse<KitchenOrdersResponse>>(`${this.baseUrl}/orders`, { params });
  }

  updateOrderStatus(orderId: number, request: UpdateOrderStatusRequest): Observable<ApiResponse<UpdateOrderStatusResponse>> {
    return this.http.patch<ApiResponse<UpdateOrderStatusResponse>>(`${this.baseUrl}/orders/${orderId}/status`, request);
  }
}



