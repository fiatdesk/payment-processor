const DIDIT_WEBHOOK_PATH = '/v1/identity/webhooks/didit';

/**
 * Didit webhook destination for identity settings help copy, derived from
 * the configured API base URL (e.g. `https://api.example.com/v1`). A relative
 * or empty base (same-origin deployments) resolves against `origin`.
 */
export function BuildDiditWebhookUrl(
  apiBaseUrl: string,
  origin: string = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  const trimmed = (apiBaseUrl ?? '').trim().replace(/\/+$/, '');
  const base = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/\/v1$/i, '')
    : origin.replace(/\/+$/, '');
  return `${base || 'https://api.yourdomain.com'}${DIDIT_WEBHOOK_PATH}`;
}
