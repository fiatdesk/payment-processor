import { DocPage } from './types';
import { NODE_INIT } from './shared';

export const CONNECTED_ACCOUNTS_PAGE: DocPage = {
  id: 'connected-accounts',
  title: 'Connected Accounts',
  description:
    'If you use Zoneless, you can issue requests on behalf of your connected accounts. To act as a connected account, include a Zoneless-Account header containing the connected account ID, which starts with the acct_z_ prefix.',
  stripeDocsUrl: 'https://docs.stripe.com/api/connected-accounts',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'The connected account ID is set per-request via the <code>Zoneless-Account</code> header. When using the Node.js SDK, pass the <code>zonelessAccount</code> option instead. Methods on the returned object reuse the same account ID.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Stripe equivalent: ',
          text: "The <code>Zoneless-Account</code> header is the equivalent of Stripe's <code>Stripe-Account</code> header, and <code>zonelessAccount</code> replaces <code>stripeAccount</code> in the Node.js SDK.",
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Use your platform API key to authenticate, then specify which connected account the request should act on. This allows your platform to retrieve balances, create payouts, and perform other operations on behalf of any connected account.',
        },
        {
          type: 'list',
          items: [
            {
              text: 'Related guide: <a href="/authentication">Authentication</a>',
              html: true,
            },
            {
              text: 'API reference: <a href="/accounts">Accounts API</a>',
              html: true,
            },
          ],
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Acting as a connected account',
          tabs: [
            {
              id: 'curl',
              label: 'cURL',
              code: `curl https://api.yourdomain.com/v1/balance \\
  -H "x-api-key: sk_live_z_YOUR_API_KEY" \\
  -H "Zoneless-Account: acct_z_1Nv0FGQ9RKHgCVdK" \\
  -G`,
            },
            {
              id: 'node',
              label: 'Node.js',
              code: `${NODE_INIT}

const balance = await zoneless.balance.retrieve({
  zonelessAccount: 'acct_z_1Nv0FGQ9RKHgCVdK',
});`,
            },
          ],
        },
      ],
    },
  ],
};
