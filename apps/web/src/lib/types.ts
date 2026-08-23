export type CustomerTier = 'STANDARD' | 'FAVORITE' | 'SPECIAL';

export interface FlashSaleInfo {
  id: string;
  startsAt: string;
  endsAt: string;
}

export interface ResolvedPrice {
  finalPrice: number;
  originalPrice: number;
  discountPercent: number;
  appliedTier: CustomerTier;
  flashSale: FlashSaleInfo | null;
}

export interface UnitInfo {
  code: string;
  name: string;
}

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  stockQty: number;
  isLowStock: boolean;
  lowStockTag: string | null;
  price: ResolvedPrice;
  category: { name: string; slug: string };
  unit: UnitInfo | null;
  images: string | string[] | null;
}

export interface ProductDetail extends ProductSummary {
  description?: string;
  images: string[];
  barcode?: string;
  sku?: string;
}

export interface ProductListResponse {
  items: ProductSummary[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  unit: UnitInfo | null;
  quantity: number;
  priceSnapshot: number;
  currentPrice: number;
  originalPrice: number;
  lineTotal: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  itemCount: number;
}

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  mobile: string;
  customerTier: CustomerTier;
  isAdmin?: boolean;
}

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface OrderEvent {
  id: string;
  status: OrderStatus;
  note: string | null;
  createdAt: string;
}

export interface OrderShippingAddress {
  fullName: string;
  city: string;
  district?: string;
  addressLine: string;
  postalCode?: string;
}

export interface OrderListItem {
  id: string;
  code: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  previewImage: string | null;
  previewName: string;
  createdAt: string;
}

export interface OrderDetail {
  id: string;
  code: string;
  status: OrderStatus;
  subtotal: number;
  shippingFee: number;
  total: number;
  contactPhone: string | null;
  shippingAddress: OrderShippingAddress | null;
  notes: string | null;
  trackingNumber: string | null;
  carrier: string | null;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    productId: string;
    name: string;
    slug: string;
    image: string | null;
    unit: UnitInfo | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  events: OrderEvent[];
  customer?: {
    id: string;
    name: string;
    mobile: string;
    tier: CustomerTier;
  };
}

export interface FlashSaleAdminItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string | null;
  standardPrice: number | null;
  salePrice: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  stockQty: number;
}
