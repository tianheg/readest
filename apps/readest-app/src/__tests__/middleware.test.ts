import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const coep = (path: string) =>
  middleware(new NextRequest(`http://localhost:3000${path}`)).headers.get(
    'Cross-Origin-Embedder-Policy',
  );

describe('middleware CORS preflight', () => {
  const preflight = (requestedHeaders?: string) =>
    middleware(
      new NextRequest('https://web.readest.com/api/sync', {
        method: 'OPTIONS',
        headers: {
          origin: 'http://tauri.localhost',
          'access-control-request-method': 'POST',
          ...(requestedHeaders && { 'access-control-request-headers': requestedHeaders }),
        },
      }),
    );

  it('echoes the requested headers instead of a wildcard so the preflight cache covers Authorization', () => {
    // The Fetch spec excludes Authorization from wildcard matching in the
    // preflight cache, so `Allow-Headers: *` forces a fresh OPTIONS round trip
    // before every authenticated API call despite Max-Age (readest-web was
    // serving ~4M preflights/day because of this).
    const res = preflight('authorization,content-type');
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('authorization,content-type');
    expect(res.headers.get('Vary')).toContain('Access-Control-Request-Headers');
    expect(res.headers.get('Access-Control-Max-Age')).toBe('86400');
  });

  it('allows Authorization and Content-Type when the preflight requests no headers', () => {
    const res = preflight();
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Authorization, Content-Type');
  });
});

describe('middleware cross-origin isolation headers', () => {
  // Fork: the /s share landing is gone (share stack removed), and with it the
  // only COEP exception — every document response is now require-corp.
  it('keeps the stricter require-corp on every document route', () => {
    expect(coep('/')).toBe('require-corp');
    expect(coep('/library')).toBe('require-corp');
    // Must not be caught by a naive startsWith('/s').
    expect(coep('/settings')).toBe('require-corp');
    expect(coep('/search')).toBe('require-corp');
  });

  it('always pairs COOP same-origin on document responses', () => {
    const res = middleware(new NextRequest('http://localhost:3000/'));
    expect(res.headers.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
  });

  it('does not put COEP on /api routes', () => {
    const res = middleware(new NextRequest('http://localhost:3000/api/metadata/search'));
    expect(res.headers.get('Cross-Origin-Embedder-Policy')).toBeNull();
  });
});
