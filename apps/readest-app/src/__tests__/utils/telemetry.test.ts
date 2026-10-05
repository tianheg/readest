import { describe, it, expect, beforeEach } from 'vitest';

// Fork note (decommercialize): this fork has no analytics client, so the suite
// no longer mocks posthog-js. What is still worth testing is the local consent
// bookkeeping and the prompt bucketing, which the settings UI reads back.
import {
  applyPostHogConsent,
  captureEvent,
  getTelemetryDecision,
  hasOptedOutTelemetry,
  optInTelemetry,
  optOutTelemetry,
  reconcileTelemetryConsent,
  rollIntoTelemetryPromptBucket,
  setTelemetryDecision,
  TELEMETRY_DECISION_KEY,
  TELEMETRY_OPT_OUT_KEY,
  TELEMETRY_PROMPT_BUCKET_RATE,
} from '@/utils/telemetry';

describe('telemetry decision storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no decision is stored', () => {
    expect(getTelemetryDecision()).toBeNull();
  });

  it('round-trips the three valid decisions', () => {
    setTelemetryDecision('opt-in');
    expect(getTelemetryDecision()).toBe('opt-in');
    setTelemetryDecision('opt-out');
    expect(getTelemetryDecision()).toBe('opt-out');
    setTelemetryDecision('pending');
    expect(getTelemetryDecision()).toBe('pending');
  });

  it('ignores garbage values written directly to the key', () => {
    localStorage.setItem(TELEMETRY_DECISION_KEY, 'something-else');
    expect(getTelemetryDecision()).toBeNull();
  });
});

describe('optInTelemetry / optOutTelemetry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opt-in records the opt-in decision and clears the opt-out flag', () => {
    optInTelemetry();
    expect(localStorage.getItem(TELEMETRY_OPT_OUT_KEY)).toBe('false');
    expect(getTelemetryDecision()).toBe('opt-in');
    expect(hasOptedOutTelemetry()).toBe(false);
  });

  it('opt-out records the opt-out decision and sets the opt-out flag', () => {
    optOutTelemetry();
    expect(localStorage.getItem(TELEMETRY_OPT_OUT_KEY)).toBe('true');
    expect(getTelemetryDecision()).toBe('opt-out');
    expect(hasOptedOutTelemetry()).toBe(true);
  });
});

describe('captureEvent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is a no-op that never throws, opted in or out', () => {
    optInTelemetry();
    expect(() => captureEvent('some_event', { a: 1 })).not.toThrow();
    optOutTelemetry();
    expect(() => captureEvent('some_event')).not.toThrow();
  });
});

describe('rollIntoTelemetryPromptBucket', () => {
  it('is true when the rng falls under the bucket rate', () => {
    expect(rollIntoTelemetryPromptBucket(() => 0)).toBe(true);
    expect(rollIntoTelemetryPromptBucket(() => TELEMETRY_PROMPT_BUCKET_RATE - 1e-9)).toBe(true);
  });

  it('is false at or above the bucket rate', () => {
    expect(rollIntoTelemetryPromptBucket(() => TELEMETRY_PROMPT_BUCKET_RATE)).toBe(false);
    expect(rollIntoTelemetryPromptBucket(() => 0.99)).toBe(false);
  });

  it('places roughly 10% of uniform draws into the bucket', () => {
    const n = 10000;
    let inBucket = 0;
    for (let i = 0; i < n; i++) {
      if (rollIntoTelemetryPromptBucket(() => i / n)) inBucket++;
    }
    // Deterministic uniform sweep: floor(n * rate) = 1000.
    expect(inBucket).toBe(Math.floor(n * TELEMETRY_PROMPT_BUCKET_RATE));
  });
});

describe('reconcileTelemetryConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('opts out when the saved settings have telemetry disabled', () => {
    optInTelemetry();

    expect(reconcileTelemetryConsent(false)).toBe(false);

    expect(hasOptedOutTelemetry()).toBe(true);
    expect(getTelemetryDecision()).toBe('opt-out');
  });

  it('keeps a recorded opt-out when the settings file says telemetry is on', () => {
    optOutTelemetry();

    // Returns false so the boot code can turn the settings switch off too.
    expect(reconcileTelemetryConsent(true)).toBe(false);

    expect(hasOptedOutTelemetry()).toBe(true);
    expect(getTelemetryDecision()).toBe('opt-out');
  });

  it('leaves the consent alone when it already matches the settings', () => {
    optOutTelemetry();

    reconcileTelemetryConsent(false);

    expect(hasOptedOutTelemetry()).toBe(true);
    expect(getTelemetryDecision()).toBe('opt-out');
  });

  it('reports telemetry as enabled when the consent is opt-in', () => {
    optInTelemetry();

    expect(reconcileTelemetryConsent(true)).toBe(true);
  });
});

describe('applyPostHogConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is a no-op that leaves the recorded decision untouched', () => {
    setTelemetryDecision('opt-in');
    applyPostHogConsent();
    expect(getTelemetryDecision()).toBe('opt-in');

    setTelemetryDecision('pending');
    applyPostHogConsent();
    expect(getTelemetryDecision()).toBe('pending');
  });
});
