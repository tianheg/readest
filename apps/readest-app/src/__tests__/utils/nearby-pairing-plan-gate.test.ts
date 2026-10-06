import { describe, expect, test, vi, afterAll } from 'vitest';

// Fork: self-hosted defaults on, which would open every premium gate and
// mask this file's plan checks — pin the deployment to its opt-out so the
// gate logic stays observable (the fork default itself is pinned in
// customization-access.test.ts).
vi.stubEnv('SELF_HOSTED', 'false');
afterAll(() => vi.unstubAllEnvs());

import {
  NEARBY_PAIRING_REQUIRES_PREMIUM,
  isNearbyPairingAllowed,
  isNearbyPairingInPlan,
} from '@/utils/access';

describe('isNearbyPairingInPlan', () => {
  test('any paid plan can pair Nearby BookDrop devices', () => {
    expect(isNearbyPairingInPlan('plus', false)).toBe(true);
    expect(isNearbyPairingInPlan('pro', false)).toBe(true);
    // A storage-only buyer reports `purchase` without being entitled.
    expect(isNearbyPairingInPlan('purchase', false)).toBe(false);
  });

  test('free plan cannot', () => {
    expect(isNearbyPairingInPlan('free', false)).toBe(false);
  });
});

describe('isNearbyPairingAllowed (premium paywall)', () => {
  test('pairing for confirmation-free drops requires a paid plan', () => {
    expect(NEARBY_PAIRING_REQUIRES_PREMIUM).toBe(true);
    expect(isNearbyPairingAllowed('free', false)).toBe(false);
    expect(isNearbyPairingAllowed('plus', false)).toBe(true);
    expect(isNearbyPairingAllowed('pro', false)).toBe(true);
    expect(isNearbyPairingAllowed('purchase', false)).toBe(false);
  });

  test('the Full Customization unlock entitles a free user', () => {
    expect(isNearbyPairingAllowed('free', true)).toBe(true);
    expect(isNearbyPairingAllowed('purchase', true)).toBe(true);
  });
});
