// Pricing tiers (prices in cents)
export const PRICING_TIERS = {
  starter:    { name: 'Starter',    min: 10,   max: 99,       price: 20000,  display: '200' },
  pro:        { name: 'Pro',        min: 100,  max: 499,      price: 125000, display: '1 250' },
  business:   { name: 'Business',   min: 500,  max: 4999,     price: 300000, display: '3 000' },
  enterprise: { name: 'Enterprise', min: 5000, max: Infinity, price: null,   display: null },
} as const;

export type PlanTierKey = keyof typeof PRICING_TIERS;

export const TRIAL_DURATION_DAYS = 30;
export const EMPLOYEE_OVERAGE_GRACE = 0.10; // 10% grace before blocking
