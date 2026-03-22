export type SubscriptionStatus = 'free' | 'premium';
export type UserRole = 'user' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  subscriptionStatus: SubscriptionStatus;
  whatsappNumber?: string;
  taxRate?: number;
  role: UserRole;
  createdAt: string;
  isUploading?: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  size: string;
  color?: string;
  material?: string;
  supplier?: string;
  imageUrl?: string;
  quantity: number;
  price: number;
  costPrice: number;
  discountPrice?: number;
  taxRate?: number;
  ownerId: string;
  createdAt: string;
  lastSoldAt?: string;
  isUploading?: boolean;
}

export interface Sale {
  id: string;
  productId: string;
  productName: string;
  quantitySold: number;
  soldAt: string;
  ownerId: string;
  totalAmount: number;
  costPrice: number;
  subtotal?: number;
  taxAmount?: number;
  taxRate?: number;
  basePrice?: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
