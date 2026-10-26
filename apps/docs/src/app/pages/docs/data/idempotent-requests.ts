import { DocPage } from './types';
import { NODE_INIT } from './shared';

export const IDEMPOTENT_REQUESTS_PAGE: DocPage = {
  id: 'idempotent-requests',
  title: 'Idempotent Requests',
  description:
    'The API supports idempotency for safely retrying requests without accidentally performing the same operation twice. When creating or updating an object, use an idempotency key. Then, if a connection error occurs, you can safely repeat the request without risk of creating a second object or performing the update twice.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'To perform an idempotent request, provide an <code>Idempotency-Key</code> header with the request.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Zoneless saves the resulting status code and body of the first request made for any given idempotency key, regardless of whether it succeeds or fails. Subsequent requests with the same key return the same result, including <code>500</code> errors.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'A client generates an idempotency key, which is a unique key that the server uses to recognize subsequent retries of the same request. How you create unique keys is up to you, but we suggest using V4 UUIDs, or another random string with enough entropy to avoid collisions.',
        },
        { type: 'heading', level: 2, text: 'Concurrent requests' },
        {
          type: 'paragraph',
          text: 'If a request is already being processed with the same idempotency key, the API returns a <code>409 Conflict</code> error. Wait briefly and retry — the original request will complete and subsequent retries will return the cached response.',
          html: true,
        },
        {
          type: 'heading',
          level: 2,
          text: 'Which requests accept idempotency keys',
        },
        {
          type: 'paragraph',
          text: "All <code>POST</code> requests accept idempotency keys. Don't send idempotency keys in <code>GET</code> and <code>DELETE</code> requests because they have no effect. These requests are idempotent by definition.",
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Idempotent request',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/accounts \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -H "Idempotency-Key: KG5LxwFBepaKHyUD" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "express",
    "country": "US",
    "email": "seller@example.com"
  }'`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const account = await zoneless.accounts.create(
  {
    type: 'express',
    country: 'US',
    email: 'seller@example.com',
  },
  {
    idempotencyKey: 'KG5LxwFBepaKHyUD',
  }
);`,
            },
          ],
        },
      ],
    },
  ],
};
