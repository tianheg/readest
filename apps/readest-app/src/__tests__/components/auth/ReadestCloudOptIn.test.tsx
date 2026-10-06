import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { SystemSettings } from '@/types/settings';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * #6010: signing in used to start a Readest Cloud upload before the user had
 * seen a single sync option. Third-party backends need premium, premium needs
 * an account, so at the moment of sign-in there is by construction no
 * third-party provider — `isReadestCloudEnabled` derives ON and
 * `useBooksSync`'s `user` effect fires. This opt-in puts the decision on the
 * sign-in page itself.
 *
 * It writes through the moment it is toggled rather than on submit: the choice
 * has to survive an OAuth redirect and a magic-link round-trip, and it has to
 * be on disk before /library mounts.
 */

const saveSettings = vi.fn(async () => {});
// useEnsureSettingsLoaded reads through this when the store is unhydrated.
const loadSettings = vi.fn(async () => useSettingsStore.getState().settings);

vi.mock('@/context/EnvContext', () => ({
  useEnv: () => ({
    envConfig: { getAppService: async () => ({ saveSettings, loadSettings }) },
    appService: null,
  }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

vi.mock('@/utils/settingsSync', () => ({
  broadcastGlobalSettings: vi.fn(),
}));

import ReadestCloudOptIn from '@/app/auth/components/ReadestCloudOptIn';

/** A fresh install: no explicit flag, no third-party backend. */
const freshInstall = {
  version: 1,
  webdav: { enabled: false },
  googleDrive: { enabled: false },
} as unknown as SystemSettings;

const withWebDAV = {
  version: 1,
  webdav: { enabled: true, serverUrl: 'https://dav.example.com', username: 'alice' },
  googleDrive: { enabled: false },
} as unknown as SystemSettings;

const box = () => screen.getByRole('checkbox') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('ReadestCloudOptIn', () => {
  test('renders nothing until the settings store is hydrated', () => {
    // A cold /auth load leaves the store empty; upstream isReadestCloudEnabled
    // derived ON from `{}` — showing a checked box over a stored opt-out.
    // (Fork: the provider is hard-off, but the hydration guard stays.)
    useSettingsStore.setState({ settings: {} as SystemSettings } as never);
    render(<ReadestCloudOptIn />);
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  test('reflects a stored opt-out rather than the empty-object default', () => {
    useSettingsStore.setState({
      settings: {
        ...freshInstall,
        readestCloud: { enabled: false, disabledAt: 1_700_000_000_000 },
      } as unknown as SystemSettings,
    } as never);
    render(<ReadestCloudOptIn />);
    expect(box().checked).toBe(false);
  });

  // Fork (decommercialize): isReadestCloudEnabled is hard-off — no vendor
  // backend exists — so the box starts unchecked even on a fresh install, and
  // it can never render checked no matter what the flag says.

  test('starts unchecked on a fresh install (vendor provider hard-off)', () => {
    useSettingsStore.setState({ settings: freshInstall } as never);
    render(<ReadestCloudOptIn />);
    expect(box().checked).toBe(false);
  });

  // The box starts unchecked, so a toggle reads as "turn it on" → the write
  // clears to the derived default (undefined) instead of pinning an opt-out.
  test('toggling clears to derived and leaves the box unchecked', async () => {
    useSettingsStore.setState({ settings: freshInstall } as never);
    render(<ReadestCloudOptIn />);

    fireEvent.click(box());

    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    expect(useSettingsStore.getState().settings.readestCloud?.enabled).toBeUndefined();
    expect(useSettingsStore.getState().settings.readestCloud?.disabledAt).toBeUndefined();
    expect(box().checked).toBe(false);
  });

  // Both toggles take the same "next = checked=true" path while the box is
  // stuck unchecked, so the flag stays in derived state throughout.
  test('two toggles keep the flag in derived state', async () => {
    useSettingsStore.setState({ settings: freshInstall } as never);
    render(<ReadestCloudOptIn />);

    fireEvent.click(box());
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1));
    fireEvent.click(box());
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(2));

    expect(useSettingsStore.getState().settings.readestCloud?.enabled).toBeUndefined();
    expect(useSettingsStore.getState().settings.readestCloud?.disabledAt).toBeUndefined();
    expect(box().checked).toBe(false);
  });

  // With a third-party backend the toggle still pins `enabled: true` into
  // settings (the derivation would disagree with clearing), but the hard-off
  // provider ignores the pin — the box stays unchecked.
  test('writes an explicit pin when a third-party backend is on, box stays unchecked', async () => {
    useSettingsStore.setState({ settings: withWebDAV } as never);
    render(<ReadestCloudOptIn />);

    // Derivation says off while WebDAV owns the library channels.
    expect(box().checked).toBe(false);

    fireEvent.click(box());

    // Clearing the flag would derive back to off, so this one has to be explicit.
    await waitFor(() => {
      expect(useSettingsStore.getState().settings.readestCloud?.enabled).toBe(true);
    });
    expect(box().checked).toBe(false);
  });
});
