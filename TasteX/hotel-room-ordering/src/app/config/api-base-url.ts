export function getApiBaseUrl(): string {
  const fromGlobal = typeof globalThis !== 'undefined'
    ? ((globalThis as unknown as { __APP_CONFIG__?: { apiBaseUrl?: string } }).__APP_CONFIG__?.apiBaseUrl ?? '')
    : '';

  const fromMeta = typeof document !== 'undefined'
    ? (document.querySelector('meta[name="api-base-url"]')?.getAttribute('content') ?? '')
    : '';

  const raw = (fromGlobal || fromMeta || '').trim();
  return raw.replace(/\/$/, '');
}

export const API_BASE_URL = getApiBaseUrl();
