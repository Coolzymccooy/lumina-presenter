import React, { useState } from 'react';
import { CheckCircle2, Zap, Users, Building2 } from 'lucide-react';
import {
  BillingPeriod,
  PlanKey,
  PLANS,
  SAVINGS,
  openPaystackCheckout,
  verifyTransaction,
} from '../services/paystackService';

interface PricingSectionProps {
  user: { uid: string; email: string | null } | null;
  userPlan?: string | null;
  onEnter: () => void;
  onPlanActivated?: (plan: string, period: string) => void;
}

const PERIOD_LABELS: Record<BillingPeriod, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
};

type Currency = 'GBP' | 'NGN';

export function PricingSection({ user, userPlan, onEnter, onPlanActivated }: PricingSectionProps) {
  const [period, setPeriod] = useState<BillingPeriod>('monthly');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const freeFeatures = [
    'Unlimited services',
    'Windows + macOS + Web',
    'Bible engine',
    'Hymn library',
    'Run sheet builder',
    '1 operator (local only)',
  ];

  const proFeatures = [
    'Everything in Free',
    'Cloud sync (3 operators)',
    'AI Assist + Gemini',
    'Motion backgrounds',
    'Audience moderation + ticker',
    'Stage confidence monitor',
    'Priority support',
  ];

  const churchFeatures = [
    'Everything in Pro',
    'Cloud sync (unlimited operators)',
    'Multi-campus environments',
    'Admin roles + access policies',
    'Dedicated onboarding call',
    'SLA support',
  ];

  async function handleCheckout(plan: PlanKey) {
    if (!user?.email) {
      onEnter(); // prompt sign-in first
      return;
    }
    setLoading(plan);
    setError(null);
    try {
      await openPaystackCheckout({
        email: user.email,
        plan,
        period,
        currency,
        userId: user.uid,
        onSuccess: async (reference) => {
          try {
            const subscription = await verifyTransaction(reference);
            onPlanActivated?.(subscription.plan, subscription.period);
          } catch {
            setError('Payment received but verification failed. Contact support with ref: ' + reference);
          } finally {
            setLoading(null);
          }
        },
        onClose: () => setLoading(null),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.');
      setLoading(null);
    }
  }

  function priceDisplay(plan: PlanKey) {
    const price = PLANS[plan][period];
    return currency === 'NGN' ? price.ngnLabel : price.label;
  }

  function basePrice(plan: PlanKey) {
    const price = PLANS[plan][period];
    if (currency === 'NGN') {
      const monthly = PLANS[plan].monthly.ngn / 100;
      return period === 'monthly'
        ? `₦${monthly.toLocaleString()}`
        : `₦${(price.ngn / 100).toLocaleString()}`;
    }
    const monthly = PLANS[plan].monthly.gbp / 100;
    return period === 'monthly'
      ? `£${monthly}`
      : `£${(price.gbp / 100).toFixed(2)}`;
  }

  const saving = SAVINGS[period];
  const activePlan = userPlan ?? 'free';

  return (
    <section id="pricing" className="py-24 px-6 bg-black border-t border-white/5">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Simple, honest pricing</h2>
          <p className="text-gray-400 mb-8">Start free. Upgrade when your team grows.</p>

          {/* Billing period toggle */}
          <div className="inline-flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-4">
            {(Object.keys(PERIOD_LABELS) as BillingPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  period === p
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {PERIOD_LABELS[p]}
                {p !== 'monthly' && (
                  <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    period === p ? 'bg-white/20 text-white' : 'bg-green-500/20 text-green-400'
                  }`}>
                    {p === 'quarterly' ? '−10%' : '−20%'}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Currency toggle */}
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="text-xs text-gray-500">Currency:</span>
            <button
              onClick={() => setCurrency('GBP')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${currency === 'GBP' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              £ GBP
            </button>
            <button
              onClick={() => setCurrency('NGN')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${currency === 'NGN' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              ₦ NGN
            </button>
          </div>

          {saving && (
            <p className="text-green-400 text-sm font-semibold mt-3">{saving} vs monthly billing</p>
          )}
        </div>

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">

          {/* Free */}
          <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-gray-400" />
              <h3 className="text-lg font-medium text-gray-400">Free</h3>
            </div>
            <div className="text-4xl font-bold text-white mb-1">£0</div>
            <p className="text-xs text-gray-500 mb-6">Forever free, no card needed</p>
            <ul className="space-y-3 mb-8 flex-1">
              {freeFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 size={15} className="text-green-500 mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            {activePlan === 'free' ? (
              <button
                onClick={onEnter}
                className="w-full py-3 rounded-xl border border-white/20 hover:bg-white hover:text-black transition-all font-bold text-sm"
              >
                {user ? 'Current plan' : 'Get started free'}
              </button>
            ) : (
              <div className="w-full py-3 rounded-xl border border-white/10 text-gray-500 text-sm text-center font-bold">
                Downgrade available
              </div>
            )}
          </div>

          {/* Pro — highlighted */}
          <div className="p-8 rounded-3xl border border-purple-500 bg-purple-500/5 flex flex-col relative transform md:-translate-y-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold px-3 py-1 rounded-b-lg uppercase tracking-wider">
              Most Popular
            </div>
            <div className="flex items-center gap-2 mb-2 mt-2">
              <Zap size={16} className="text-purple-400" />
              <h3 className="text-lg font-medium text-purple-400">Pro</h3>
            </div>
            <div className="text-4xl font-bold text-white mb-1">{basePrice('pro')}</div>
            <p className="text-xs text-purple-400/70 mb-6">
              {period !== 'monthly' ? `Billed ${priceDisplay('pro')}` : 'per operator / month'}
            </p>
            <ul className="space-y-3 mb-8 flex-1">
              {proFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-white">
                  <CheckCircle2 size={15} className="text-purple-400 mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            {activePlan === 'pro' ? (
              <div className="w-full py-3 rounded-xl bg-purple-600/30 border border-purple-500 text-purple-200 text-sm text-center font-bold">
                Current plan
              </div>
            ) : (
              <button
                onClick={() => handleCheckout('pro')}
                disabled={loading === 'pro'}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white transition-all font-bold text-sm shadow-lg shadow-purple-900/50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading === 'pro' ? 'Opening checkout…' : user ? 'Upgrade to Pro' : 'Start free trial'}
              </button>
            )}
          </div>

          {/* Church Team */}
          <div className="p-8 rounded-3xl border border-cyan-500/20 bg-cyan-500/5 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <Users size={16} className="text-cyan-400" />
              <h3 className="text-lg font-medium text-cyan-400">Church Team</h3>
            </div>
            <div className="text-4xl font-bold text-white mb-1">{basePrice('church')}</div>
            <p className="text-xs text-cyan-400/70 mb-6">
              {period !== 'monthly' ? `Billed ${priceDisplay('church')}` : 'per campus / month'}
            </p>
            <ul className="space-y-3 mb-8 flex-1">
              {churchFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                  <CheckCircle2 size={15} className="text-cyan-400 mt-0.5 shrink-0" /> {f}
                </li>
              ))}
            </ul>
            {activePlan === 'church' ? (
              <div className="w-full py-3 rounded-xl bg-cyan-600/20 border border-cyan-500 text-cyan-200 text-sm text-center font-bold">
                Current plan
              </div>
            ) : (
              <button
                onClick={() => handleCheckout('church')}
                disabled={loading === 'church'}
                className="w-full py-3 rounded-xl border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 transition-all font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading === 'church' ? 'Opening checkout…' : 'Get Church Team'}
              </button>
            )}
          </div>
        </div>

        {/* Enterprise footnote */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl border border-white/10 bg-white/[0.02]">
            <Building2 size={18} className="text-gray-500" />
            <p className="text-sm text-gray-400">
              Multi-campus or denomination-wide deployment?{' '}
              <a href="mailto:hello@luminapresenter.com" className="text-white font-semibold hover:text-purple-300 transition-colors">
                Contact us for Enterprise
              </a>
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 max-w-xl mx-auto p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {/* Trust badges */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs text-gray-600">
          <span>Secured by Paystack</span>
          <span>·</span>
          <span>Cancel anytime</span>
          <span>·</span>
          <span>NGN + GBP accepted</span>
          <span>·</span>
          <span>Bank transfer, card, USSD</span>
        </div>
      </div>
    </section>
  );
}
