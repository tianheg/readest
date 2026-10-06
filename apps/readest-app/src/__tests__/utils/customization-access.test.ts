import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { jwtDecode } from 'jwt-decode';
import {
  getCustomizationPurchased,
  isCustomizationAllowed,
  isCustomTranslatorAllowed,
  isSelfHosted,
} from '@/utils/access';

vi.mock('jwt-decode', () => ({ jwtDecode: vi.fn() }));

const mockToken = (claims: Record<string, unknown>) => {
  (jwtDecode as unknown as ReturnType<typeof vi.fn>).mockReturnValue(claims);
  return 'token';
};

describe('getCustomizationPurchased', () => {
  it('reads the claim minted by custom_access_token_hook', () => {
    expect(getCustomizationPurchased(mockToken({ customization_purchased: true }))).toBe(true);
  });

  it('is false when the claim is absent, so old tokens do not unlock it', () => {
    expect(getCustomizationPurchased(mockToken({ plan: 'free' }))).toBe(false);
  });
});

describe('isCustomizationAllowed', () => {
  // Fork: self-hosted reads on by default, which would mask every entitlement
  // branch below — pin the deployment to its opt-out so plan/purchase logic
  // stays observable; the self-hosted describe flips it back on.
  beforeEach(() => vi.stubEnv('SELF_HOSTED', 'false'));
  afterEach(() => vi.unstubAllEnvs());

  it('allows an explicit purchase on any plan', () => {
    expect(isCustomizationAllowed('free', true)).toBe(true);
  });

  it('allows subscription tiers without a separate purchase', () => {
    expect(isCustomizationAllowed('plus', false)).toBe(true);
    expect(isCustomizationAllowed('pro', false)).toBe(true);
  });

  // `getUserProfilePlan` reports 'purchase' for anyone holding ANY one-time
  // purchase, which is how a storage add-on presents. Treating that as
  // entitlement would hand Full Customization to every storage buyer.
  it('does not treat a storage-only buyer as entitled', () => {
    expect(isCustomizationAllowed('purchase', false)).toBe(false);
  });

  it('denies a free user who has not bought it', () => {
    expect(isCustomizationAllowed('free', false)).toBe(false);
  });
});

// A self-hosted deployment has no store to buy from, and the operator already
// runs the infrastructure the paywall funds, so everything is unlocked.
describe('self-hosted deployments', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Fork: self-hosted defaults ON — this build has no store or paywall, so a
  // deployment where nobody set any variable still unlocks everything.
  it('is on by default', () => {
    expect(isSelfHosted()).toBe(true);
  });

  // The only escape hatch: an explicit 'false' at either layer.
  it('honors an explicit SELF_HOSTED=false opt-out', () => {
    vi.stubEnv('SELF_HOSTED', 'false');
    expect(isSelfHosted()).toBe(false);
  });

  it('honors an explicit NEXT_PUBLIC_SELF_HOSTED=false opt-out', () => {
    vi.stubEnv('NEXT_PUBLIC_SELF_HOSTED', 'false');
    expect(isSelfHosted()).toBe(false);
  });

  it('unlocks premium for a signed-in free user with no purchase', () => {
    vi.stubEnv('SELF_HOSTED', 'true');
    expect(isCustomizationAllowed('free', false)).toBe(true);
  });

  it('unlocks premium with no login at all, where the plan reads free', () => {
    vi.stubEnv('NEXT_PUBLIC_SELF_HOSTED', 'true');
    expect(isCustomizationAllowed('free', false)).toBe(true);
  });

  // A blank SELF_HOSTED must never carry the opt-out: `||` advances past the
  // empty string to the public variable (and the fork default beyond it).
  it('falls through an explicitly empty SELF_HOSTED', () => {
    vi.stubEnv('SELF_HOSTED', '');
    vi.stubEnv('NEXT_PUBLIC_SELF_HOSTED', 'true');
    expect(isSelfHosted()).toBe(true);
  });
});

// Custom translators (the user's own LLM endpoint or DeepL key) are premium.
// The reader decides from the session token alone, so a signed-out reader is
// locked unless the deployment is self-hosted.
describe('isCustomTranslatorAllowed', () => {
  // Fork: same opt-out pin as isCustomizationAllowed — keep the plan logic
  // observable while self-hosted defaults on.
  beforeEach(() => vi.stubEnv('SELF_HOSTED', 'false'));
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows a subscriber', () => {
    expect(isCustomTranslatorAllowed(mockToken({ plan: 'plus' }))).toBe(true);
  });

  it('allows a free user who bought Full Customization', () => {
    expect(isCustomTranslatorAllowed(mockToken({ customization_purchased: true }))).toBe(true);
  });

  it('denies a free user and a storage-only buyer', () => {
    expect(isCustomTranslatorAllowed(mockToken({ plan: 'free' }))).toBe(false);
    expect(
      isCustomTranslatorAllowed(mockToken({ plan: 'free', storage_purchased_bytes: 1e9 })),
    ).toBe(false);
  });

  it('denies a signed-out reader', () => {
    expect(isCustomTranslatorAllowed(null)).toBe(false);
  });

  it('allows a signed-out reader on a self-hosted deployment', () => {
    // Drop the describe's opt-out pin first — a blank SELF_HOSTED falls
    // through to the public variable below.
    vi.unstubAllEnvs();
    vi.stubEnv('NEXT_PUBLIC_SELF_HOSTED', 'true');
    expect(isCustomTranslatorAllowed(null)).toBe(true);
  });
});
