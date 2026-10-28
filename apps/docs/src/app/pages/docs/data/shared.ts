import {
  AttributeTooltip,
  CalloutBlock,
  DocPageSection,
  DocSubSection,
  EndpointSummary,
} from './types';

export const NODE_INIT = `import { FiatDesk } from '@fiatdesk/node';
const fiatdesk = new FiatDesk('sk_live_fd_YOUR_API_KEY', 'https://api.yourdomain.com');`;

/** Hover tooltip shown next to expandable attribute types. */
export const EXPAND_TOOLTIP: AttributeTooltip = {
  label: 'Expandable',
  content:
    'This can be <a href="/expanding_objects">expanded</a> into an object with the <code>expand</code> request parameter.',
};

/**
 * What hosted Checkout does when the platform's default wallet changes
 * after a payment was prepared (Checkout Sessions, PaymentIntents and
 * Payment Links all pay through it).
 */
export const MERCHANT_WALLET_CHANGED_CALLOUT: CalloutBlock = {
  type: 'callout',
  variant: 'info',
  title: 'FiatDesk extension: ',
  text: "If the platform sets another default wallet after a payment was prepared, confirming it returns a <code>409</code> <code>merchant_wallet_changed</code> with the message \"The merchant's receiving wallet changed. Please approve the payment again.\" Nothing is sent and nothing else changes: hosted Checkout prepares the payment again and the customer approves a payment to the new wallet. A payment already submitted to the old wallet still completes and is credited, and so does any payment that used the session's authorization and paid one of the platform's own wallets (a <code>transaction_hash</code> the client sends is verified before anything is refused); the dashboard flags USDC that lands outside the default wallet. Subscription Checkout pays the plan's destination, and waits (<code>payment_pending</code>) while the plan moves to the new wallet on-chain.",
  html: true,
};

/**
 * What happens when a platform sets another default wallet (Fable Q13):
 * shared by the Self-hosting and Subscriptions pages.
 */
export const CHANGING_PLATFORM_WALLET_SECTION: DocPageSection = {
  left: [
    { type: 'heading', level: 2, text: 'Changing your platform wallet' },
    {
      type: 'paragraph',
      text: 'Your platform can hold up to 5 wallets; the default one does every job. Make another wallet the default from <strong>Settings → Wallets</strong> in the dashboard, or with the API: create a wallet with <code>default_for_currency: true</code>, or update an existing one with it. To replace the default, also pass <code>archive_previous: true</code>: the old wallet is deleted in the same step. The switch is refused with a <code>409</code> <code>payout_batch_in_progress</code> while a payout batch of the old wallet is built or broadcast. Then everything moves to the new default except the USDC:',
      html: true,
    },
    {
      type: 'list',
      items: [
        {
          text: '<strong>Checkout:</strong> New payments pay the new wallet. A payment prepared for the old wallet but not yet submitted is answered with a <code>409</code> <code>merchant_wallet_changed</code>, and the customer approves it again for the new wallet. One already submitted to the old wallet still completes and is credited.',
          html: true,
        },
        {
          text: '<strong>Top-ups:</strong> Only USDC arriving at the new default is counted as a top-up.',
          html: true,
        },
        {
          text: '<strong>Payouts:</strong> The new wallet signs them, and needs ETH for gas, a USDC approval for the payout contract, and the USDC it pays out.',
          html: true,
        },
        {
          text: "<strong>Subscription plans:</strong> The destination change of each active recurring price's plan is recorded on the price (<code>subscription_plan_destination_change</code>) and sent from <code>SUBSCRIPTION_OPERATOR_KEY</code>; the switch does not wait for it. A plan of an archived price that still bills subscriptions moves the same way before its next charge. The billing run follows each change by its hash, re-pricing one stuck for 10 minutes, and does not charge a plan while its change is <code>pending</code>, so no renewal pays the old wallet. The switch request sends up to 3 changes itself and leaves the rest to the billing run; its response's <code>plan_migrations_queued</code> says how many. A charge sent in the moment before the switch commits can still pay the old wallet: it is credited, and its USDC is flagged with the old wallet's other deposits. A plan the operator key does not own fails with <code>plan_owner_mismatch</code>. Keep the billing run scheduled (or the billing monitor enabled) so changes confirm.",
          html: true,
        },
      ],
    },
    {
      type: 'callout',
      variant: 'warning',
      title: 'Your USDC stays in the old wallet. ',
      text: "A switch moves no funds. Send the old wallet's USDC to the new default after switching. Until it arrives, the available balance counts only the new wallet's USDC, and payouts above that amount fail. The dashboard's Wallets list shows what each wallet holds (<code>include_usdc_balance=true</code> on the API), and the switch confirm names the amount and both addresses.",
      html: true,
    },
    {
      type: 'paragraph',
      text: 'FiatDesk keeps watching the platform\'s other wallets: active wallets that are not the default, for as long as they exist, and removed wallets for 30 days after removal. Each has its own scan cursor and uses the same scan as top-ups. USDC sent to them is never credited, because only the default wallet\'s funds can be paid out. It is listed in <code>archived_wallet_deposits</code> of <a href="/balance/details">balance details</a>, logged as a warning, and shown as a banner on the dashboard. Send the funds to the default wallet, then <a href="/balance/acknowledge-archived-deposit">acknowledge</a> the alert.',
      html: true,
    },
    {
      type: 'callout',
      variant: 'info',
      title: 'Connected accounts are different. ',
      text: "A connected account's new default wallet applies to its future payouts only. Its other wallets are not watched.",
    },
  ],
};

/**
 * Build overview endpoint rows, resolving human-readable titles from the
 * resource subsection sidebar entries (matched by pageId).
 */
export function BuildEndpointSummaries(
  subsection: DocSubSection,
  endpoints: Array<{
    method: 'GET' | 'POST' | 'DELETE';
    path: string;
    pageId: string;
    title?: string;
  }>
): EndpointSummary[] {
  const titleById = new Map(
    (subsection.children ?? []).map((child) => [child.id, child.title])
  );
  return endpoints.map((endpoint) => ({
    method: endpoint.method,
    path: endpoint.path,
    pageId: endpoint.pageId,
    title: endpoint.title ?? titleById.get(endpoint.pageId),
  }));
}
