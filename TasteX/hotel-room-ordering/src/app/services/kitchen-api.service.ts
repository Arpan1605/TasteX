import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

@Injectable({ providedIn: 'root' })
export class KitchenApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/kitchen';

  login(request: KitchenLoginRequest): Observable<ApiResponse<KitchenLoginResponse>> {
    return this.http.post<ApiResponse<KitchenLoginResponse>>(`${this.baseUrl}/login`, request);
  }
}
