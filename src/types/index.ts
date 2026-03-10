/**
 * Shared TypeScript types for StreamCPA
 * Centralizes enums, interfaces, and utility types used across the app
 */

// ==========================================
// ENUMS (mirror Prisma enums for client use)
// ==========================================

export type UserRole = "STREAMER" | "BRAND" | "ADMIN";

export type StreamerStatus = "ONBOARDING" | "ACTIVE" | "SUSPENDED" | "BANNED";

export type BrandStatus =
  | "PENDING_VERIFICATION"
  | "ACTIVE"
  | "SUSPENDED"
  | "REJECTED";

export type CampaignStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "COMPLETED"
  | "CANCELLED";

export type ConversionType =
  | "SIGNUP"
  | "DEPOSIT"
  | "PURCHASE"
  | "INSTALL"
  | "LEAD"
  | "CUSTOM";

export type ApplicationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN";

export type ConversionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "UNDER_REVIEW";

export type PayoutStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type PayoutMethod = "paypal" | "wise";

export type DepositStatus = "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";

export type NotificationType =
  | "APPLICATION_RECEIVED"
  | "APPLICATION_APPROVED"
  | "APPLICATION_REJECTED"
  | "CONVERSION_NEW"
  | "CONVERSION_APPROVED"
  | "PAYOUT_COMPLETED"
  | "PAYOUT_FAILED"
  | "CAMPAIGN_STATUS_CHANGED"
  | "BRAND_VERIFIED"
  | "SYSTEM";

// ==========================================
// DASHBOARD METRICS
// ==========================================

export interface StreamerDashboardMetrics {
  balanceAvailable: number;
  balancePending: number;
  totalEarned: number;
  streamerScore: number;
  twitchDisplayName: string | null;
  twitchAvatar: string | null;
  status: StreamerStatus;
  totalClicks: number;
  totalConversions: number;
  activeLinks: number;
  epc: number; // earnings per click
}

export interface BrandDashboardMetrics {
  companyName: string;
  logo: string | null;
  status: BrandStatus;
  escrowBalance: number;
  totalSpent: number;
  campaignCount: number;
  totalConversions: number;
  activeStreamers: number;
}

export interface AdminStats {
  totalUsers: number;
  totalStreamers: number;
  totalBrands: number;
  totalCampaigns: number;
  totalConversions: number;
  totalRevenue: number;
  pendingBrandVerifications: number;
  pendingPayouts: number;
  fraudAlerts: number;
}

// ==========================================
// AFFILIATE LINK
// ==========================================

export interface AffiliateLink {
  id: string;
  slug: string;
  url: string;
  isActive: boolean;
  totalClicks: number;
  uniqueClicks: number;
  totalConversions: number;
  totalEarnings: number;
  conversionRate: number;
  campaign: {
    id: string;
    name: string;
    slug: string;
    payoutPerConversion: number;
    conversionType: ConversionType;
    status: CampaignStatus;
    brand: {
      companyName: string;
      logo: string | null;
    };
  };
  createdAt: Date;
}

// ==========================================
// CAMPAIGN DETAIL
// ==========================================

export interface CampaignDetail {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: CampaignStatus;
  conversionType: ConversionType;
  payoutPerConversion: number;
  platformFee: number;
  totalBudget: number;
  remainingBudget: number;
  spent: number;
  totalClicks: number;
  totalConversions: number;
  targetUrl: string;
  attributionWindow: number;
  countries: string[];
  categories: string[];
  minFollowers: number;
  autoApprove: boolean;
  materials: CampaignMaterial[];
  applications: CampaignApplication[];
  createdAt: Date;
}

export interface CampaignMaterial {
  id: string;
  type: "IMAGE" | "VIDEO" | "TEXT" | "LINK";
  title: string;
  url: string | null;
  content: string | null;
}

export interface CampaignApplication {
  id: string;
  status: ApplicationStatus;
  message: string | null;
  appliedAt: Date;
  reviewedAt: Date | null;
  streamer: {
    id: string;
    twitchDisplayName: string | null;
    twitchUsername: string | null;
    twitchAvatar: string | null;
    twitchFollowers: number;
    avgViewers: number;
    streamerScore: number;
    country: string | null;
  };
  affiliateLink: {
    slug: string;
    totalClicks: number;
    totalConversions: number;
    totalEarnings: number;
  } | null;
}

// ==========================================
// EARNINGS & PAYOUTS
// ==========================================

export interface EarningsSummary {
  totalEarned: number;
  balanceAvailable: number;
  balancePending: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  conversionsByStatus: {
    approved: number;
    pending: number;
    rejected: number;
  };
}

export interface ConversionRecord {
  id: string;
  status: ConversionStatus;
  payout: number;
  fraudScore: number;
  conversionType: ConversionType;
  createdAt: Date;
  campaign: {
    name: string;
    brand: {
      companyName: string;
    };
  };
}

export interface PayoutRecord {
  id: string;
  amount: number;
  method: PayoutMethod;
  status: PayoutStatus;
  requestedAt: Date;
  processedAt: Date | null;
  failureReason: string | null;
  externalId: string | null;
}

// ==========================================
// BILLING (Brand)
// ==========================================

export interface DepositRecord {
  id: string;
  amount: number;
  status: DepositStatus;
  stripeSessionId: string | null;
  createdAt: Date;
}

export interface BillingOverview {
  escrowBalance: number;
  totalDeposited: number;
  totalSpent: number;
  deposits: DepositRecord[];
}

// ==========================================
// FRAUD
// ==========================================

export interface FraudSignal {
  rule: string;
  score: number;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface FraudReport {
  totalScore: number;
  signals: FraudSignal[];
  recommendation: "approve" | "review" | "reject";
  analyzedAt: Date;
}

// ==========================================
// UTILITY TYPES
// ==========================================

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  hasMore: boolean;
}

/** Date range filter */
export interface DateRange {
  from: Date;
  to: Date;
}

/** Sort direction */
export type SortDirection = "asc" | "desc";

/** Common table sort config */
export interface SortConfig<T extends string = string> {
  field: T;
  direction: SortDirection;
}
