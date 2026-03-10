import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AdminKitchenDto {
  kitchenId: number;
  cityId: number;
  cityName: string;
  name: string;
  addressLine?: string | null;
  contactPhone?: string | null;
  managerName?: string | null;
  isActive: boolean;
  hotelsCount: number;
  ordersCount: number;
  revenue: number;
  loginUsername?: string | null;
  hasPasswordConfigured?: boolean;
}

export interface AdminCityDto {
  cityId: number;
  name: string;
  stateName?: string | null;
  isActive: boolean;
  kitchensCount: number;
  hotelsCount: number;
  revenue: number;
}

export interface AdminHotelDto {
  hotelId: number;
  cityId: number;
  cityName: string;
  kitchenId: number;
  kitchenName: string;
  hotelCode: string;
  name: string;
  addressLine?: string | null;
  roomCount: number;
  isActive: boolean;
  ordersCount: number;
  revenue: number;
  qrCodeUrl: string;
}

export interface UpsertKitchenRequest {
  cityId: number;
  name: string;
  addressLine?: string;
  contactPhone?: string;
  managerName?: string;
  isActive: boolean;
  loginUsername?: string;
  loginPassword?: string;
}

export interface UpsertCityRequest {
  name: string;
  stateName?: string;
  isActive: boolean;
}

export interface UpsertHotelRequest {
  cityId: number;
  kitchenId: number;
  name: string;
  addressLine?: string;
  roomCount: number;
  isActive: boolean;
}

export interface AdminMenuItemDto {
  itemId: number;
  categoryId: number;
  name: string;
  description?: string | null;
  price: number;
  isVeg: boolean;
  isActive: boolean;
  prepTimeMinutes?: number | null;
  imageUrl?: string | null;
  inventoryQuantity?: number | null;
  availableKitchenIds: number[];
}

export interface AdminMenuCategoryDto {
  categoryId: number;
  categoryName: string;
  sortOrder: number;
  items: AdminMenuItemDto[];
}

export interface CreateMenuItemRequest {
  categoryId: number;
  name: string;
  description?: string;
  price: number;
  isVeg: boolean;
  isActive: boolean;
  prepTimeMinutes?: number | null;
  imageUrl?: string;
  availableKitchenIds: number[];
}

export interface UpdateMenuItemStatusRequest {
  isActive: boolean;
}

export interface UpsertCategoryRequest {
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface UpsertHotelMenuItemRequest {
  categoryId: number;
  name: string;
  description?: string;
  price: number;
  isVeg: boolean;
  isActive: boolean;
  prepTimeMinutes?: number | null;
  imageUrl?: string;
  inventoryQuantity: number;
}

export interface UpdateHotelMenuItemStatusRequest {
  isActive: boolean;
}

export interface UpdateHotelMenuInventoryRequest {
  inventoryQuantity: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error?: {
    code?: string;
    message?: string;
    validationErrors?: Record<string, string[]>;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/admin';

  getCities(): Observable<ApiResponse<AdminCityDto[]>> {
    return this.http.get<ApiResponse<AdminCityDto[]>>(`${this.baseUrl}/cities`);
  }

  createCity(request: UpsertCityRequest): Observable<ApiResponse<AdminCityDto>> {
    return this.http.post<ApiResponse<AdminCityDto>>(`${this.baseUrl}/cities`, request);
  }

  updateCity(cityId: number, request: UpsertCityRequest): Observable<ApiResponse<AdminCityDto>> {
    return this.http.put<ApiResponse<AdminCityDto>>(`${this.baseUrl}/cities/${cityId}`, request);
  }

  getKitchens(): Observable<ApiResponse<AdminKitchenDto[]>> {
    return this.http.get<ApiResponse<AdminKitchenDto[]>>(`${this.baseUrl}/kitchens`);
  }

  createKitchen(request: UpsertKitchenRequest): Observable<ApiResponse<AdminKitchenDto>> {
    return this.http.post<ApiResponse<AdminKitchenDto>>(`${this.baseUrl}/kitchens`, request);
  }

  updateKitchen(kitchenId: number, request: UpsertKitchenRequest): Observable<ApiResponse<AdminKitchenDto>> {
    return this.http.put<ApiResponse<AdminKitchenDto>>(`${this.baseUrl}/kitchens/${kitchenId}`, request);
  }

  getHotels(): Observable<ApiResponse<AdminHotelDto[]>> {
    return this.http.get<ApiResponse<AdminHotelDto[]>>(`${this.baseUrl}/hotels`);
  }

  createHotel(request: UpsertHotelRequest): Observable<ApiResponse<AdminHotelDto>> {
    return this.http.post<ApiResponse<AdminHotelDto>>(`${this.baseUrl}/hotels`, request);
  }

  updateHotel(hotelId: number, request: UpsertHotelRequest): Observable<ApiResponse<AdminHotelDto>> {
    return this.http.put<ApiResponse<AdminHotelDto>>(`${this.baseUrl}/hotels/${hotelId}`, request);
  }

  getMenu(): Observable<ApiResponse<AdminMenuCategoryDto[]>> {
    return this.http.get<ApiResponse<AdminMenuCategoryDto[]>>(`${this.baseUrl}/menu`);
  }

  createCategory(request: UpsertCategoryRequest): Observable<ApiResponse<AdminMenuCategoryDto>> {
    return this.http.post<ApiResponse<AdminMenuCategoryDto>>(`${this.baseUrl}/menu/categories`, request);
  }

  updateCategory(categoryId: number, request: UpsertCategoryRequest): Observable<ApiResponse<AdminMenuCategoryDto>> {
    return this.http.put<ApiResponse<AdminMenuCategoryDto>>(`${this.baseUrl}/menu/categories/${categoryId}`, request);
  }

  deleteCategory(categoryId: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.baseUrl}/menu/categories/${categoryId}`);
  }

  createMenuItem(request: CreateMenuItemRequest): Observable<ApiResponse<AdminMenuItemDto>> {
    return this.http.post<ApiResponse<AdminMenuItemDto>>(`${this.baseUrl}/menu/items`, request);
  }

  updateMenuItemStatus(itemId: number, request: UpdateMenuItemStatusRequest): Observable<ApiResponse<AdminMenuItemDto>> {
    return this.http.patch<ApiResponse<AdminMenuItemDto>>(`${this.baseUrl}/menu/items/${itemId}/status`, request);
  }

  getHotelMenu(hotelId: number): Observable<ApiResponse<AdminMenuCategoryDto[]>> {
    return this.http.get<ApiResponse<AdminMenuCategoryDto[]>>(`${this.baseUrl}/hotels/${hotelId}/menu`);
  }

  createHotelMenuItem(hotelId: number, request: UpsertHotelMenuItemRequest): Observable<ApiResponse<AdminMenuItemDto>> {
    return this.http.post<ApiResponse<AdminMenuItemDto>>(`${this.baseUrl}/hotels/${hotelId}/menu/items`, request);
  }

  updateHotelMenuItem(hotelId: number, itemId: number, request: UpsertHotelMenuItemRequest): Observable<ApiResponse<AdminMenuItemDto>> {
    return this.http.put<ApiResponse<AdminMenuItemDto>>(`${this.baseUrl}/hotels/${hotelId}/menu/items/${itemId}`, request);
  }

  updateHotelMenuItemStatus(hotelId: number, itemId: number, request: UpdateHotelMenuItemStatusRequest): Observable<ApiResponse<AdminMenuItemDto>> {
    return this.http.patch<ApiResponse<AdminMenuItemDto>>(`${this.baseUrl}/hotels/${hotelId}/menu/items/${itemId}/status`, request);
  }

  updateHotelMenuInventory(hotelId: number, itemId: number, request: UpdateHotelMenuInventoryRequest): Observable<ApiResponse<AdminMenuItemDto>> {
    return this.http.patch<ApiResponse<AdminMenuItemDto>>(`${this.baseUrl}/hotels/${hotelId}/menu/items/${itemId}/inventory`, request);
  }

  deleteHotelMenuItem(hotelId: number, itemId: number): Observable<ApiResponse<boolean>> {
    return this.http.delete<ApiResponse<boolean>>(`${this.baseUrl}/hotels/${hotelId}/menu/items/${itemId}`);
  }
}