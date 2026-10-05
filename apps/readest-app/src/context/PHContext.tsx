'use client';

import { ReactNode } from 'react';

// Fork note (decommercialize): upstream initialised PostHog here with a project
// token baked in at release build time, and every capture call in the app went
// through it. This fork ships no analytics at all — the provider is a
// pass-through and init is a no-op, so nothing in the app can emit telemetry
// even when a call site still asks for it. Removing the SDK also removes the
// `atob(NEXT_PUBLIC_DEFAULT_POSTHOG_KEY_BASE64)` read, whose value only exists
// in the vendor's release environment.
export const initPostHog = () => {};

export const CSPostHogProvider = ({ children }: { children: ReactNode }) => {
  return <>{children}</>;
};
