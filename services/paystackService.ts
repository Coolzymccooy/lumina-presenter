// Paystack inline checkout integration.
// Loads the Paystack Inline JS on first use, then reuses it.
// Prices are stored server-side via plan codes; this file only
// handles the browser-side popup and transaction verification.

export type BillingPeriod = 'monthly' | 'quarterly' | 'annual';
export type PlanKey = 'pro' | 'church';

export interface PlanPrice {
  gbp: number;        // price in pence (GBP)
  ngn: number;        // price in kobo (NGN)
  label: string;      // e.g. "£10/mo"
  ngnLabel: string;   // e.g. "₦8,000/mo"
  planCode: string;   // Paystack plan code (set via env VITE_PAYSTACK_PLAN_*)
}

// Plan codes come from env vars set in your Paystack dashboard.
// Format: VITE_PAYSTACK_PLAN_{PLAN}_{PERIOD}
// e.g. VITE_PAYSTACK_PLAN_PRO_MONTHLY = "PLN_xxxx"
const planCode = (key: string) =>
  (import.meta.env as Record<string, string>)[`VITE_PAYSTACK_PLAN_${key}`] ?? '';

export const PLANS: Record<PlanKey, Record<BillingPeriod, PlanPrice>> = {
  pro: {
    monthly:   { gbp: 1000, ngn: 800000,  label: '£10/mo',      ngnLabel: '₦8,000/mo',    planCode: planCode('PRO_MONTHLY') },
    quarterly: { gbp: 2700, ngn: 2160000, label: '£27/qtr',     ngnLabel: '₦21,600/qtr',  planCode: planCode('PRO_QUARTERLY') },
    annual:    { gbp: 9600, ngn: 7680000, label: '£96/yr',       ngnLabel: '₦76,800/yr',   planCode: planCode('PRO_ANNUAL') },
  },
  church: {
    monthly:   { gbp: 2500, ngn: 2000000, label: '£25/mo',      ngnLabel: '₦20,000/mo',   planCode: planCode('CHURCH_MONTHLY') },
    quarterly: { gbp: 6750, ngn: 5400000, label: '£67.50/qtr',  ngnLabel: '₦54,000/qtr',  planCode: planCode('CHURCH_QUARTERLY') },
    annual:    { gbp: 24000,ngn:19200000, label: '£240/yr',      ngnLabel: '₦192,000/yr',  planCode: planCode('CHURCH_ANNUAL') },
  },
};

export const SAVINGS: Record<BillingPeriod, string | null> = {
  monthly:   null,
  quarterly: 'Save 10%',
  annual:    'Save 20%',
};

declare global {
  interface Window {
    PaystackPop?: {
      setup: (options: PaystackSetupOptions) => { openIframe: () => void };
    };
  }
}

interface PaystackSetupOptions {
  key: string;
  email: string;
  plan?: string;
  amount?: number;
  currency?: string;
  ref?: string;
  metadata?: Record<string, unknown>;
  callback: (response: { reference: string }) => void;
  onClose: () => void;
}

let scriptLoaded = false;

function loadPaystackScript(): Promise<void> {
  if (scriptLoaded || window.PaystackPop) {
    scriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => {
      scriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Paystack script'));
    document.head.appendChild(script);
  });
}

export interface CheckoutOptions {
  email: string;
  plan: PlanKey;
  period: BillingPeriod;
  currency?: 'GBP' | 'NGN';
  userId?: string;
  onSuccess: (reference: string) => void;
  onClose?: () => void;
}

export async function openPaystackCheckout(opts: CheckoutOptions): Promise<void> {
  const publicKey = (import.meta.env as Record<string, string>).VITE_PAYSTACK_PUBLIC_KEY ?? '';
  if (!publicKey) throw new Error('VITE_PAYSTACK_PUBLIC_KEY is not configured');

  await loadPaystackScript();

  const price = PLANS[opts.plan][opts.period];
  const currency = opts.currency ?? 'GBP';
  const amount = currency === 'NGN' ? price.ngn : price.gbp;

  const handler = window.PaystackPop!.setup({
    key: publicKey,
    email: opts.email,
    plan: price.planCode || undefined,
    amount: price.planCode ? undefined : amount, // plan code takes precedence
    currency,
    metadata: {
      lumina_plan: opts.plan,
      lumina_period: opts.period,
      lumina_uid: opts.userId ?? '',
    },
    callback: (response) => opts.onSuccess(response.reference),
    onClose: () => opts.onClose?.(),
  });

  handler.openIframe();
}

export async function verifyTransaction(reference: string): Promise<{ plan: string; period: string; status: string }> {
  const response = await fetch(`/api/payments/verify/${encodeURIComponent(reference)}`);
  if (!response.ok) throw new Error('Transaction verification failed');
  const data = await response.json();
  if (!data.ok) throw new Error(data.message ?? 'Verification failed');
  return data.subscription;
}
