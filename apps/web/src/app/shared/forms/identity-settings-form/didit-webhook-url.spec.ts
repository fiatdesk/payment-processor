import { BuildDiditWebhookUrl } from './didit-webhook-url';

describe('BuildDiditWebhookUrl', () => {
  it('uses an absolute API origin and drops the /v1 suffix', () => {
    expect(BuildDiditWebhookUrl('https://api.example.com/v1')).toBe(
      'https://api.example.com/v1/identity/webhooks/didit'
    );
  });

  it('accepts an absolute API origin without a path', () => {
    expect(BuildDiditWebhookUrl('https://api.example.com/')).toBe(
      'https://api.example.com/v1/identity/webhooks/didit'
    );
  });

  it('resolves a relative API base against the page origin', () => {
    expect(BuildDiditWebhookUrl('/v1', 'https://pay.example.com')).toBe(
      'https://pay.example.com/v1/identity/webhooks/didit'
    );
  });

  it('falls back to a placeholder when no origin is available', () => {
    expect(BuildDiditWebhookUrl('', '')).toBe(
      'https://api.yourdomain.com/v1/identity/webhooks/didit'
    );
  });
});
