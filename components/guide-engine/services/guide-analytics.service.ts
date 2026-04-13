import type { GuideAnalyticsEvent } from '../types/guide.types';

type Payload = Record<string, unknown>;

function track(event: GuideAnalyticsEvent, payload: Payload = {}): void {
  // Integrate with the existing analytics service without creating a hard
  // dependency on Firebase being configured. The guide engine is used during
  // onboarding where the user may not yet be authenticated.
  try {
    const fullPayload = { ...payload, source: 'guide-engine', clientTimestamp: Date.now() };

    // Dispatch a custom DOM event so other parts of the app (and tests) can
    // observe guide analytics without coupling to Firebase directly.
    window.dispatchEvent(
      new CustomEvent('lumina:guide-analytics', { detail: { event, payload: fullPayload } })
    );
  } catch {
    // Never let analytics crash the guide
  }
}

export const guideAnalytics = { track };
