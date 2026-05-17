// =============================================================================
// ReplyRocket — plan definitions (SRS Section 13)
// Single source of truth: pricing page, billing API, usage limits, and
// feature gating all import from here. Update HERE, not in multiple places.
// =============================================================================

// Plan IDs created in Razorpay Dashboard (Subscriptions → Plans → Create Plan).
// Each paid plan must have a corresponding env var with the Razorpay plan ID.
//   RAZORPAY_PLAN_PRO_ID     -> plan_xxxxx
//   RAZORPAY_PLAN_GROWTH_ID  -> plan_xxxxx
//   RAZORPAY_PLAN_AGENCY_ID  -> plan_xxxxx
// Free plan has no Razorpay plan ID (no payment required).

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Try it. Forever free.',
    price: 0,
    currency: 'INR',
    period: 'monthly',
    popular: false,
    razorpay_plan_env: null,
    features: [
      '100 DMs / month',
      '1 social account',
      'Basic analytics',
      'Comment-to-DM automation',
      'Unified inbox',
    ],
    limits: {
      monthly_dms: 100,
      social_accounts: 1,
      ai_replies: false,
      crm: false,
      team_members: 1,
      whatsapp: false,
      api_access: false,
      white_label: false,
      priority_support: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For serious creators & solo businesses.',
    price: 999,
    currency: 'INR',
    period: 'monthly',
    popular: true,
    razorpay_plan_env: 'RAZORPAY_PLAN_PRO_ID',
    features: [
      'Unlimited automations',
      'AI replies (Claude 4.5)',
      'Full CRM with lead scoring',
      'Advanced analytics',
      'Priority comment processing',
    ],
    limits: {
      monthly_dms: 10000,
      social_accounts: 1,
      ai_replies: true,
      crm: true,
      team_members: 1,
      whatsapp: false,
      api_access: false,
      white_label: false,
      priority_support: false,
    },
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    tagline: 'For growing teams & WhatsApp commerce.',
    price: 3999,
    currency: 'INR',
    period: 'monthly',
    popular: false,
    razorpay_plan_env: 'RAZORPAY_PLAN_GROWTH_ID',
    features: [
      'Everything in Pro',
      'Team access (up to 5 members)',
      'WhatsApp Cloud API',
      'Advanced AI (memory, intent)',
      'API integrations',
      'Multi-language AI',
    ],
    limits: {
      monthly_dms: 100000,
      social_accounts: 3,
      ai_replies: true,
      crm: true,
      team_members: 5,
      whatsapp: true,
      api_access: true,
      white_label: false,
      priority_support: false,
    },
  },
  agency: {
    id: 'agency',
    name: 'Agency',
    tagline: 'White-label for agencies.',
    price: 9999,
    currency: 'INR',
    period: 'monthly',
    popular: false,
    razorpay_plan_env: 'RAZORPAY_PLAN_AGENCY_ID',
    features: [
      'Everything in Growth',
      'Multi-client management',
      'White-label branding',
      'Advanced revenue analytics',
      'Priority support (SLA)',
      'Unlimited team members',
    ],
    limits: {
      monthly_dms: 1000000,
      social_accounts: 25,
      ai_replies: true,
      crm: true,
      team_members: 100,
      whatsapp: true,
      api_access: true,
      white_label: true,
      priority_support: true,
    },
  },
}

export const PLAN_ORDER = ['free', 'pro', 'growth', 'agency']

export function getPlan(planId) {
  return PLANS[planId] || PLANS.free
}

export function getRazorpayPlanId(planId) {
  const plan = PLANS[planId]
  if (!plan?.razorpay_plan_env) return null
  return process.env[plan.razorpay_plan_env] || null
}

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

// Default plan for new signups
export const DEFAULT_PLAN = 'free'

// Status values a user's subscription can be in (mirrors Razorpay's vocabulary)
export const SUBSCRIPTION_STATES = {
  created: 'pending',         // sub created, awaiting first payment
  authenticated: 'pending',   // 1st payment authorized, awaiting capture
  active: 'active',           // currently billing
  pending: 'pending',         // payment failed, retrying
  halted: 'halted',           // payments stopped after max retries
  cancelled: 'cancelled',
  completed: 'cancelled',
  expired: 'cancelled',
}
