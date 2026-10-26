import crypto from 'node:crypto';
import {
  Webhooks,
  WebhookSignatureVerificationError,
} from '../resources/Webhooks';

function SignPayload(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

describe('Webhooks', () => {
  const webhooks = new Webhooks();
  const secret = 'whsec_test';
  const payload = JSON.stringify({
    id: 'evt_1',
    object: 'event',
    type: 'charge.succeeded',
  });

  it('constructs a verified event', () => {
    const header = SignPayload(payload, secret, Math.floor(Date.now() / 1000));
    const event = webhooks.constructEvent(payload, header, secret);
    expect(event).toEqual({
      id: 'evt_1',
      object: 'event',
      type: 'charge.succeeded',
    });
  });

  it('rejects an invalid signature', () => {
    const timestamp = Math.floor(Date.now() / 1000);
    expect(() =>
      webhooks.constructEvent(payload, `t=${timestamp},v1=deadbeef`, secret)
    ).toThrow(WebhookSignatureVerificationError);
  });
});
