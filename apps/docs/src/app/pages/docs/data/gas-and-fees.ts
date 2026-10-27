// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { DocPage } from './types';

// Every figure on this page is an estimate. The gas amounts come from the
// estimates in the design plus Foundry's `forge test --gas-report` against
// the MockUSDC test token (execution gas, plus the 21 000 base cost of a
// transaction and calldata). The real USDC proxy costs a little more.
const GAS_TABLE = `Operation                           Paid by   Gas       1 gwei   5 gwei   20 gwei
Single payout (USDC transfer)       platform  ~62 k     $0.19    $0.93    $3.72
PayoutBatch.disperse, 50 payouts    platform  ~2.55 M   $7.65    $38      $153
  per payout                                  ~51 k     $0.15    $0.77    $3.06
approve(PayoutBatch), one time      platform  ~46 k     $0.14    $0.69    $2.76
Checkout relay (EIP-3009)           operator  ~85 k     $0.26    $1.28    $5.10
Subscriptions.charge                operator  ~85 k     $0.26    $1.28    $5.10
subscribeWithAuthorization relay    operator  ~140 k    $0.42    $2.10    $8.40
subscribeWithPermit relay           operator  ~195 k    $0.59    $2.93    $11.70
  (first-time wallet: permit + subscribe)
On-chain cancel                     operator  ~60 k     $0.18    $0.90    $3.60
createPlan, once per recurring      operator  ~180 k    $0.54    $2.70    $10.80
price

Estimates only. Assumes ETH at $3,000 (a placeholder),
gas = gas used x gas price, USD = gas x gwei x 3,000 / 10^9.`;

const ESTIMATED_FEE_EXAMPLE = `{
  "estimated_fee": "1800000000000000",
  "fee_currency": "eth",
  "gas_limit": "120000",
  "max_fee_per_gas": "15000000000"
}

// estimated_fee = gas_limit x max_fee_per_gas
//   = 120000 x 15000000000 wei
//   = 0.0018 ETH (an upper bound, not what you will pay)
//   = $5.40 at ETH = $3,000 (placeholder)`;

export const GAS_AND_FEES_PAGE: DocPage = {
  id: 'gas-and-fees',
  title: 'Gas and fees',
  description:
    'What Ethereum network gas costs, who pays it for each operation, and how to keep payouts economical. All figures are estimates.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'Zoneless charges no platform fee and takes no percentage cut. You pay Ethereum network gas for each on-chain transaction: typically a few cents to a few dollars, depending on network load. Batch payouts to share it.',
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'These numbers are estimates. ',
          text: 'Gas used depends on the token contract and on the state of the wallets involved. The gas price changes block by block. The dollar amounts assume ETH at $3,000, which is a placeholder: check the current price and the current gas price (gwei) before you plan around them.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Who pays gas' },
        {
          type: 'list',
          items: [
            {
              text: '<strong>Your customers pay no gas at checkout.</strong> They sign an authorization (a message, not a transaction) and your relayer submits it. The relayer is the wallet behind <code>CHECKOUT_RELAYER_KEY</code>, so it needs ETH.',
              html: true,
            },
            {
              text: '<strong>Subscriptions are relayed the same way.</strong> The customer signs the <code>Subscribe</code> message and, for a first-time wallet, a USDC permit. The relayer sends both in one transaction. Recurring charges, on-chain plan creation and on-chain cancels are sent by the wallet behind <code>SUBSCRIPTION_OPERATOR_KEY</code>, which needs ETH too.',
              html: true,
            },
            {
              text: '<strong>Seller payouts are paid by your platform wallet.</strong> It holds the USDC it sends and pays gas in ETH for the one-time approval and for every payout transaction. Sellers receive the full payout amount.',
              html: true,
            },
            {
              text: '<strong>Top-ups are plain USDC transfers</strong> that you send to your platform wallet. Whoever sends the transfer pays its gas.',
              html: true,
            },
            {
              text: '<strong>A customer pays gas only for actions they choose to send themselves</strong>, such as revoking their USDC allowance to the Subscriptions contract.',
              html: true,
            },
          ],
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Estimated gas cost (ETH at $3,000)',
          tabs: [{ id: 'table', label: 'Estimates', code: GAS_TABLE }],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Reading the estimate' },
        {
          type: 'paragraph',
          text: 'The build endpoint returns <code>estimated_fee</code> for the transaction you are about to sign: a string in the atomic units of <code>fee_currency</code> (<code>eth</code>, so wei; 1 ETH is 10<sup>18</sup> wei). It is an upper bound, <code>gas_limit</code> multiplied by <code>max_fee_per_gas</code>. A transaction usually costs less, because you pay the actual base fee plus your priority fee, not the maximum. Convert it to dollars yourself with the current ETH price. The dashboard payout dialog shows the fee in ETH, the gas price cap, and the fee per recipient; it does not show a dollar estimate or a warning when the fee is large compared with the payout.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Payouts in simulated test mode have no fee. The <code>estimated_fee</code> field is still present, with <code>fee_currency</code> set to <code>none</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Reading estimated_fee',
          tabs: [{ id: 'fee', label: 'Example', code: ESTIMATED_FEE_EXAMPLE }],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Batching' },
        {
          type: 'paragraph',
          text: 'A batch of up to 100 payouts is one transaction. Batching saves the 21,000 gas base cost of every extra transaction and one signature, which comes to roughly 15 to 25 percent per payout. It does not cut the cost by an order of magnitude, because the USDC transfer to each seller is most of the gas. A 50-payout batch costs about 51,000 gas per payout against about 62,000 for a payout sent alone.',
        },
        {
          type: 'paragraph',
          text: '<code>payouts.processAll()</code> and <code>payouts.processBatch()</code> build batches for you. The first batch for a wallet also sends the one-time approval of the PayoutBatch contract.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Keeping costs down' },
        {
          type: 'list',
          items: [
            {
              text: '<strong>Time your batches.</strong> The gas price is the biggest lever, and it is often several times lower at quiet hours. Read <code>estimated_fee</code> from the build endpoint and schedule batches when it is low. Unsigned builds expire, so build close to when you sign.',
              html: true,
            },
            {
              text: '<strong>Pay out less often, in larger amounts.</strong> A weekly payout run costs a fraction of daily payouts to the same sellers.',
              html: true,
            },
            {
              text: '<strong>Set a minimum payout.</strong> Gas is a fixed cost per payout, so small payouts lose the most. As a rule of thumb, set the minimum so that the per-payout fee is under 10 percent of the amount. At 5 gwei with a batch of 50, the fee is about $0.77 per payout, so a minimum of roughly $8 is the break-even; $20 or more is comfortable. At 20 gwei the same rule means about $30 or more. Hold balances below your minimum until they reach it.',
              html: true,
            },
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Keep the signing wallets funded. ',
          text: 'The platform wallet needs USDC and ETH, and the relayer and subscription operator wallets need ETH. When one runs out of ETH its transactions stop: checkout confirmations, renewals or payouts, depending on the wallet. Top them up before the balance reaches a few transactions.',
        },
      ],
    },
  ],
};
