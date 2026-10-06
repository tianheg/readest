import { describe, expect, test, vi, afterAll } from 'vitest';

// Fork: self-hosted defaults on, which would open every premium gate and
// mask this file's plan checks — pin the deployment to its opt-out so the
// gate logic stays observable (the fork default itself is pinned in
// customization-access.test.ts).
vi.stubEnv('SELF_HOSTED', 'false');
afterAll(() => vi.unstubAllEnvs());

import {
  ABS_OFFLINE_REQUIRES_PREMIUM,
  isAbsOfflineAllowed,
  isAbsOfflineInPlan,
} from '@/utils/access';

describe('isAbsOfflineInPlan', () => {
  test('any paid plan can download Audiobookshelf books for offline use', () => {
    expect(isAbsOfflineInPlan('plus', false)).toBe(true);
    expect(isAbsOfflineInPlan('pro', false)).toBe(true);
    // A storage-only buyer reports `purchase` without being entitled.
    expect(isAbsOfflineInPlan('purchase', false)).toBe(false);
  });

  test('free plan cannot', () => {
    expect(isAbsOfflineInPlan('free', false)).toBe(false);
  });
});

describe('isAbsOfflineAllowed (premium paywall)', () => {
  test('offline Audiobookshelf downloads require a paid plan', () => {
    expect(ABS_OFFLINE_REQUIRES_PREMIUM).toBe(true);
    expect(isAbsOfflineAllowed('free', false)).toBe(false);
    expect(isAbsOfflineAllowed('plus', false)).toBe(true);
    expect(isAbsOfflineAllowed('pro', false)).toBe(true);
    expect(isAbsOfflineAllowed('purchase', false)).toBe(false);
  });

  test('entitles a free user who bought Full Customization', () => {
    expect(isAbsOfflineAllowed('free', true)).toBe(true);
  });
});
