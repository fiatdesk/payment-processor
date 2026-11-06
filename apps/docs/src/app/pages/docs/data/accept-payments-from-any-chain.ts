import { DocPage } from './types';

const nearIntentsDocsUrl = 'https://docs.near-intents.org/';
const partnersUrl = 'https://partners.near-intents.org/';

const ExternalLink = (url: string, label: string): string =>
  `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}<img src="/assets/icons/open-in-new-tab.svg" alt="" class="external-link-icon" /></a>`;

const CROSS_CHAIN_JSON = `{
  "id": "cs_fd_8Hq2mXw4",
  "object": "checkout.session",
  "status": "open",
  "payment_details": {
    "cross_chain": {
      "provider": "near_intents",
      "origin_asset": "near",
      "origin_network": "near",
      "deposit_address": "d41f5c0e7a9b3b62e08c1f7d5a46e9b210c3f8a7d5e4b6c9a1f20d3e8b7c4a51",
      "amount_in": "2310000000000000000000000",
      "amount_in_formatted": "2.31",
      "amount_out": "5750000",
      "refund_address": "mara.near",
      "quote_deadline": 1793958300,
      "correlation_id": "c0a8f1e2-7b3d-4e6a-9d12-5f48b3a07c91",
      "status": "PENDING_DEPOSIT",
      "origin_transaction_hash": null,
      "settlement_transaction_hash": null,
      "simulated": false
    }
  }
}`;

const CROSS_CHAIN_CURL = `# 1. Quote a payment and get a one-time deposit address
curl https://api.yourdomain.com/v1/payment_pages/pay_7Kd2Lm/cross_chain \\
  -d origin_asset=near \\
  -d refund_address=mara.near

# 2. Poll the swap. The session completes when the status is SUCCESS
curl https://api.yourdomain.com/v1/payment_pages/pay_7Kd2Lm/cross_chain

# 3. Optional: tell FiatDesk about the deposit transaction
curl https://api.yourdomain.com/v1/payment_pages/pay_7Kd2Lm/cross_chain/deposit \\
  -d transaction_hash=7xQ4n2VfYb9Rk1TgHs3Jw8PzUe6CdLaMo5NiXy0BvKt

# Simulated mode only: pretend the deposit arrived
curl -X POST https://api.yourdomain.com/v1/test_helpers/checkout/sessions/cs_fd_8Hq2mXw4/cross_chain_deposit \\
  -H "x-api-key: $FIATDESK_API_KEY"`;

export const ACCEPT_PAYMENTS_FROM_ANY_CHAIN_PAGE: DocPage = {
  id: 'accept-payments-from-any-chain',
  title: 'Accept payments from any chain',
  description:
    'Let customers pay a Checkout Session with assets from another chain while you still receive USDC on Ethereum.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: `FiatDesk Checkout normally takes USDC from an Ethereum wallet. With cross-chain payments, a customer can instead pay with another asset on another chain, such as NEAR. The swap runs through ${ExternalLink(
            nearIntentsDocsUrl,
            'NEAR Intents'
          )}, and your wallet still receives USDC on Ethereum.`,
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'FiatDesk extension: ',
          text: 'Cross-chain payments are a FiatDesk addition. They use the same Checkout Session, the same <code>checkout.session.completed</code> event, and the same Charge as a wallet payment, so your integration does not change. The new fields are described under <a href="/checkout-sessions">Checkout Sessions</a> and <a href="/charges">Charges</a>.',
          html: true,
        },
        {
          type: 'heading',
          level: 2,
          text: 'What your customer sees',
        },
        {
          type: 'list',
          items: [
            {
              text: '1. On the Checkout page, the customer chooses to pay from another chain, picks the asset they hold, and enters a refund address on that chain.',
            },
            {
              text: '2. Checkout shows an exact amount of that asset and a one-time deposit address, with a countdown until the quote expires.',
            },
            {
              text: '3. The customer sends the amount from their own wallet. Checkout watches the swap and shows the payment as complete once USDC reaches you.',
            },
          ],
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Cross-chain endpoints',
          tabs: [
            { id: 'curl', label: 'cURL', code: CROSS_CHAIN_CURL },
            {
              id: 'json',
              label: 'payment_details.cross_chain',
              code: CROSS_CHAIN_JSON,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'How it works' },
        {
          type: 'list',
          items: [
            {
              text: 'FiatDesk asks NEAR Intents for an <code>EXACT_OUTPUT</code> quote for the session total in USDC, recorded as <code>amount_out</code>. The swap is expected to deliver that amount; FiatDesk does not check the delivered amount on-chain. The customer pays whatever amount of their asset that takes.',
              html: true,
            },
            {
              text: 'The quote comes with a one-time deposit address. It appears on the session as <code>payment_details.cross_chain</code>.',
              html: true,
            },
            {
              text: 'When the deposit arrives, solvers swap it and send USDC to your merchant wallet on Ethereum.',
            },
            {
              text: "FiatDesk checks the swap, and only when its status is <code>SUCCESS</code> does the session complete through the normal payment path. The Charge records the customer's chain in <code>origin_network</code>.",
              html: true,
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'The three <code>payment_pages</code> routes shown on the right belong to the hosted Checkout page and need no API key. A payment you started is reported by the same <code>checkout.session.completed</code> webhook as any other.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Modes' },
        {
          type: 'paragraph',
          text: 'Set <code>NEAR_INTENTS_MODE</code> to choose how cross-chain payments run. See <a href="/environment-variables">Environment variables</a> for all three settings.',
          html: true,
        },
        {
          type: 'list',
          items: [
            {
              text: '<code>off</code>: Cross-chain payment is not offered. This is the default outside simulated test mode.',
              html: true,
            },
            {
              text: '<code>simulated</code>: Quotes are made up and no funds move. Checkout shows a banner saying so. This is the default in test mode on the simulated settlement rail. In test mode, call <code>POST /v1/test_helpers/checkout/sessions/:id/cross_chain_deposit</code> to mark the deposit as arrived.',
              html: true,
            },
            {
              text: '<code>live</code>: Real swaps on NEAR Intents mainnet. Requires <code>LIVEMODE=true</code>.',
              html: true,
            },
          ],
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Live mode moves real money. ',
          text: 'There is no NEAR Intents testnet. In live mode customers send real assets on mainnet and you receive real USDC. Try the flow in simulated mode first.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Limits' },
        {
          type: 'list',
          items: [
            {
              text: 'Mainnet only. Only the assets Checkout lists are accepted.',
            },
            {
              text: 'A quote lasts 30 minutes, or until the session expires if that is sooner. A swap usually finishes within 1 to 10 minutes. After <code>quote_deadline</code> the customer must request a new quote.',
              html: true,
            },
            {
              text: 'A session completes only on <code>SUCCESS</code>. If the swap ends as <code>REFUNDED</code> or <code>FAILED</code>, the session stays open. NEAR Intents is expected to return the deposit to the refund address; FiatDesk does not confirm the refund.',
              html: true,
            },
            {
              text: 'The amount due is checked against the quote. If the line items change after the quote, a delivery for the old amount does not complete the session, and the customer gets a new quote.',
            },
            {
              text: 'Settlement is trusted from the NEAR Intents status. FiatDesk does not check the USDC delivery independently on-chain.',
            },
            {
              text: 'Refunds go to the refund address the customer entered, on their own chain. Ask for it carefully: a wrong address cannot be corrected.',
            },
            {
              text: 'Solvers earn a spread on each swap, so the customer pays slightly more than the USD price.',
            },
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Optional partner key. ',
          text: `Quotes without an API key carry an extra 0.25% fee. Request a key from ${ExternalLink(
            partnersUrl,
            'NEAR Intents partners'
          )} and set <code>NEAR_INTENTS_API_KEY</code> to avoid it.`,
          html: true,
        },
      ],
    },
  ],
};
