export type FoodPreference = 'All' | 'Veg' | 'NonVeg';
export type PaymentStatus = 'Pending' | 'Paid' | 'Failed';
export type PaymentMethod = 'COD';
export type OrderStatus = 'Accepted' | 'Preparing' | 'Ready' | 'Delivered' | 'Rejected';

export interface City {
  id: number;
  code: string;
  name: string;
}

export interface Kitchen {
  id: number;
  cityId: number;
  name: string;
}

export interface Hotel {
  id: number;
  cityId: number;
  kitchenId: number;
  code: string;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  sortOrder: number;
}

export interface Item {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  isVeg: boolean;
  active: boolean;
}

export interface KitchenItemAvailability {
  kitchenId: number;
  itemId: number;
  isAvailable: boolean;
}

export interface CartItem {
  itemId: number;
  quantity: number;
}

export interface OrderLine {
  itemId: number;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: number;
  orderNo: string;
  hotelId: number;
  kitchenId: number;
  mobile: string;
  roomNumber?: string;
  lines: OrderLine[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  acceptedAt?: string;
  preparingStartedAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OtpSession {
  mobile: string;
  otp: string;
  expiresAt: string;
  verified: boolean;
}

export interface MenuCategory {
  category: Category;
  items: Item[];
}




