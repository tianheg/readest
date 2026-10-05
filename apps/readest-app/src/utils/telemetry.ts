// Fork note (decommercialize): upstream backed every helper here with PostHog.
// This fork keeps the API surface (localStorage consent bookkeeping, prompt
// bucketing, reconcile) so no call site has to change, but the SDK is gone:
// every function that would have talked to PostHog is a no-op.

export const TELEMETRY_OPT_OUT_KEY = 'readest-telemetry-opt-out';
export const TELEMETRY_DECISION_KEY = 'readest-telemetry-decision';

export type TelemetryDecision = 'opt-in' | 'opt-out' | 'pending';

/** Fraction of new users shown the consent prompt; the rest are opted out silently. */
export const TELEMETRY_PROMPT_BUCKET_RATE = 0.1;

export const hasOptedOutTelemetry = () => {
  return localStorage.getItem(TELEMETRY_OPT_OUT_KEY) === 'true';
};

export const getTelemetryDecision = (): TelemetryDecision | null => {
  if (typeof window === 'undefined') return null;
  const value = localStorage.getItem(TELEMETRY_DECISION_KEY);
  if (value === 'opt-in' || value === 'opt-out' || value === 'pending') return value;
  return null;
};

export const setTelemetryDecision = (decision: TelemetryDecision) => {
  localStorage.setItem(TELEMETRY_DECISION_KEY, decision);
};

/** Returns true with probability TELEMETRY_PROMPT_BUCKET_RATE. */
export const rollIntoTelemetryPromptBucket = (rng: () => number = Math.random) => {
  return rng() < TELEMETRY_PROMPT_BUCKET_RATE;
};

/** No-op in this fork: there is no analytics client to capture to. */
export const captureEvent = (_event: string, _properties?: Record<string, unknown>) => {};

// The consent records below are kept as local bookkeeping only — nothing reads
// them back for reporting, because no reporting exists in this fork.
export const optInTelemetry = () => {
  localStorage.setItem(TELEMETRY_OPT_OUT_KEY, 'false');
  setTelemetryDecision('opt-in');
};
export const optOutTelemetry = () => {
  localStorage.setItem(TELEMETRY_OPT_OUT_KEY, 'true');
  setTelemetryDecision('opt-out');
};

export const applyPostHogConsent = () => {};

/**
 * Line the recorded consent up with the saved setting. Kept so the settings
 * switch and its stored decision stay consistent across boots.
 *
 * Returns the effective setting, so the caller can switch a stale `true` in
 * the settings file off and the settings panel shows what is in effect.
 */
export const reconcileTelemetryConsent = (telemetryEnabled: boolean) => {
  if (!telemetryEnabled && !hasOptedOutTelemetry()) {
    optOutTelemetry();
  }
  return !hasOptedOutTelemetry();
};
