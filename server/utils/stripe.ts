import Stripe from 'stripe';

const config = useRuntimeConfig();

if (!config.stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is required');
}

// Initialize Stripe with secret key and handle initialization errors
export const stripe = new Stripe(config.stripeSecretKey as string, {
  apiVersion: '2023-10-16', // Using the latest stable API version
  typescript: true,
  telemetry: false, // Disable telemetry for better performance
  timeout: 10000, // 10 second timeout
});

// Product and Price configuration
export const STRIPE_PLANS = {
  starter: {
    priceId: config.stripeStarterPriceId || 'price_starter_monthly',
    name: 'Starter',
    amount: 900, // €9.00 in cents
    interval: 'month' as const,
    features: ['basic_dashboard', 'api_access', 'email_support'],
    limits: {
      apiCalls: 1000,
      storage: 500,
      projects: 3,
      collaborators: 2,
    },
  },
  pro: {
    priceId: config.stripeProPriceId || 'price_pro_monthly',
    name: 'Pro',
    amount: 1900, // €19.00 in cents
    interval: 'month' as const,
    features: ['advanced_dashboard', 'unlimited_api', 'priority_support', 'analytics'],
    limits: {
      apiCalls: 10000,
      storage: 5000,
      projects: 50,
      collaborators: 10,
    },
  },
  business: {
    priceId: config.stripBusinessPriceId || 'price_business_monthly',
    name: 'Business',
    amount: 4900, // €49.00 in cents
    interval: 'month' as const,
    features: ['everything_pro', 'team_management', 'sso', 'advanced_security'],
    limits: {
      apiCalls: 100000,
      storage: 50000,
      projects: 999,
      collaborators: 50,
    },
  },
} as const;

export type StripePlanKey = keyof typeof STRIPE_PLANS;

// Helper functions
export function getPlanByPriceId(
  priceId: string
): { key: StripePlanKey; plan: (typeof STRIPE_PLANS)[StripePlanKey] } | null {
  for (const [key, plan] of Object.entries(STRIPE_PLANS)) {
    if (plan.priceId === priceId) {
      return { key: key as StripePlanKey, plan };
    }
  }
  return null;
}

export function formatAmount(amountInCents: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amountInCents / 100);
}

// Webhook signature verification
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event | null {
  try {
    const webhookSecret = config.stripeWebhookSecret;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret as string);
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return null;
  }
}

// Customer management
export async function getOrCreateStripeCustomer(
  userId: string,
  email: string,
  name?: string
): Promise<Stripe.Customer> {
  // First try to find existing customer by metadata
  const customers = await stripe.customers.list({
    email: email,
    limit: 1,
  });

  // Check if any customer has matching metadata
  const existingCustomer = customers.data.find(
    customer => customer.metadata && customer.metadata.supabase_user_id === userId
  );

  if (existingCustomer) {
    return existingCustomer;
  }

  // Create new customer
  return stripe.customers.create({
    email,
    name,
    metadata: {
      supabase_user_id: userId,
    },
  });
}

// Subscription management
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  metadata?: Record<string, string>
): Promise<Stripe.Checkout.Session> {
  return stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: metadata || {},
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_update: {
      address: 'auto',
      name: 'auto',
    },
  });
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// Subscription status helpers
export function getSubscriptionStatus(subscription: Stripe.Subscription): {
  isActive: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  willRenew: boolean;
  currentPeriodEnd: Date;
} {
  const currentPeriodEnd = new Date((subscription as any).current_period_end * 1000);

  return {
    isActive: subscription.status === 'active',
    isPastDue: subscription.status === 'past_due',
    isCanceled: subscription.status === 'canceled' || (subscription as any).cancel_at_period_end,
    willRenew: !(subscription as any).cancel_at_period_end && subscription.status === 'active',
    currentPeriodEnd,
  };
}
