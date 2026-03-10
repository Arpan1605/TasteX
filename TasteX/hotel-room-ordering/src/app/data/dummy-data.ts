import {
  Category,
  City,
  Hotel,
  Item,
  Kitchen,
  KitchenItemAvailability,
  Order
} from '../models/domain.models';

export const CITIES: City[] = [
  { id: 1, code: 'BLR', name: 'Bengaluru' },
  { id: 2, code: 'MUM', name: 'Mumbai' },
  { id: 3, code: 'DEL', name: 'Delhi' }
];

export const KITCHENS: Kitchen[] = [
  { id: 11, cityId: 1, name: 'Bengaluru Central Kitchen' },
  { id: 12, cityId: 1, name: 'Bengaluru South Kitchen' },
  { id: 21, cityId: 2, name: 'Mumbai Airport Kitchen' },
  { id: 31, cityId: 3, name: 'Delhi Signature Kitchen' }
];

export const HOTELS: Hotel[] = [
  { id: 101, cityId: 1, kitchenId: 11, code: 'blr-gp-01', name: 'Grand Plaza Bengaluru' },
  { id: 102, cityId: 1, kitchenId: 12, code: 'blr-aur-01', name: 'Aurora Stay Bengaluru' },
  { id: 201, cityId: 2, kitchenId: 21, code: 'mum-sea-01', name: 'Sea Breeze Mumbai' },
  { id: 301, cityId: 3, kitchenId: 31, code: 'del-sky-01', name: 'Skyline Delhi' }
];

export const CATEGORIES: Category[] = [
  { id: 1, name: 'Breakfast', sortOrder: 1 },
  { id: 2, name: 'Main Course', sortOrder: 2 },
  { id: 3, name: 'Snacks', sortOrder: 3 },
  { id: 4, name: 'Beverages', sortOrder: 4 }
];

export const ITEMS: Item[] = [
  { id: 1001, categoryId: 1, name: 'Idli Sambar', description: 'Steamed rice cakes with sambar', price: 140, isVeg: true, active: true },
  { id: 1002, categoryId: 1, name: 'Masala Omelette', description: 'Three-egg omelette with onions and herbs', price: 180, isVeg: false, active: true },
  { id: 2001, categoryId: 2, name: 'Paneer Butter Masala', description: 'Rich tomato gravy with paneer', price: 320, isVeg: true, active: true },
  { id: 2002, categoryId: 2, name: 'Chicken Biryani', description: 'Dum-style aromatic biryani', price: 390, isVeg: false, active: true },
  { id: 2003, categoryId: 2, name: 'Grilled Fish', description: 'Herb marinated fish fillet', price: 450, isVeg: false, active: true },
  { id: 3001, categoryId: 3, name: 'French Fries', description: 'Crispy salted fries', price: 160, isVeg: true, active: true },
  { id: 3002, categoryId: 3, name: 'Chicken Nuggets', description: 'Crunchy breaded chicken bites', price: 230, isVeg: false, active: true },
  { id: 4001, categoryId: 4, name: 'Fresh Lime Soda', description: 'Sweet and salted lime cooler', price: 120, isVeg: true, active: true },
  { id: 4002, categoryId: 4, name: 'Cold Coffee', description: 'Chilled coffee with cream', price: 170, isVeg: true, active: true }
];

export const KITCHEN_ITEM_AVAILABILITY: KitchenItemAvailability[] = [
  { kitchenId: 11, itemId: 1001, isAvailable: true },
  { kitchenId: 11, itemId: 1002, isAvailable: true },
  { kitchenId: 11, itemId: 2001, isAvailable: true },
  { kitchenId: 11, itemId: 2002, isAvailable: true },
  { kitchenId: 11, itemId: 2003, isAvailable: false },
  { kitchenId: 11, itemId: 3001, isAvailable: true },
  { kitchenId: 11, itemId: 3002, isAvailable: true },
  { kitchenId: 11, itemId: 4001, isAvailable: true },
  { kitchenId: 11, itemId: 4002, isAvailable: true },

  { kitchenId: 12, itemId: 1001, isAvailable: true },
  { kitchenId: 12, itemId: 1002, isAvailable: false },
  { kitchenId: 12, itemId: 2001, isAvailable: true },
  { kitchenId: 12, itemId: 2002, isAvailable: true },
  { kitchenId: 12, itemId: 2003, isAvailable: true },
  { kitchenId: 12, itemId: 3001, isAvailable: true },
  { kitchenId: 12, itemId: 3002, isAvailable: true },
  { kitchenId: 12, itemId: 4001, isAvailable: true },
  { kitchenId: 12, itemId: 4002, isAvailable: false },

  { kitchenId: 21, itemId: 1001, isAvailable: true },
  { kitchenId: 21, itemId: 1002, isAvailable: true },
  { kitchenId: 21, itemId: 2001, isAvailable: true },
  { kitchenId: 21, itemId: 2002, isAvailable: true },
  { kitchenId: 21, itemId: 2003, isAvailable: true },
  { kitchenId: 21, itemId: 3001, isAvailable: true },
  { kitchenId: 21, itemId: 3002, isAvailable: false },
  { kitchenId: 21, itemId: 4001, isAvailable: true },
  { kitchenId: 21, itemId: 4002, isAvailable: true },

  { kitchenId: 31, itemId: 1001, isAvailable: true },
  { kitchenId: 31, itemId: 1002, isAvailable: true },
  { kitchenId: 31, itemId: 2001, isAvailable: true },
  { kitchenId: 31, itemId: 2002, isAvailable: false },
  { kitchenId: 31, itemId: 2003, isAvailable: true },
  { kitchenId: 31, itemId: 3001, isAvailable: true },
  { kitchenId: 31, itemId: 3002, isAvailable: true },
  { kitchenId: 31, itemId: 4001, isAvailable: true },
  { kitchenId: 31, itemId: 4002, isAvailable: true }
];

export const DUMMY_ORDERS: Order[] = [
  {
    id: 1,
    orderNo: 'TX-10001',
    hotelId: 101,
    kitchenId: 11,
    mobile: '9876543210',
    roomNumber: '304',
    lines: [
      { itemId: 2002, quantity: 1, unitPrice: 390 },
      { itemId: 4002, quantity: 1, unitPrice: 170 }
    ],
    totalAmount: 560,
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Preparing',
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 20 * 60000).toISOString()
  },
  {
    id: 2,
    orderNo: 'TX-10002',
    hotelId: 102,
    kitchenId: 12,
    mobile: '9988776655',
    roomNumber: '112',
    lines: [{ itemId: 2001, quantity: 1, unitPrice: 320 }],
    totalAmount: 320,
    paymentMethod: 'COD',
    paymentStatus: 'Pending',
    status: 'Accepted',
    createdAt: new Date(Date.now() - 12 * 60000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 60000).toISOString()
  }
];

