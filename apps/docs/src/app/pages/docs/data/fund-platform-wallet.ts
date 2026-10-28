// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { DocPage } from './types';

const dashboardBalanceUrl = 'https://pay.yourdomain.com/account/balance';
const dashboardSettingsUrl = 'https://pay.yourdomain.com/account/settings';
const coinbaseUrl = 'https://www.coinbase.com/';
const krakenUrl = 'https://www.kraken.com/';
const circleFaucetUrl = 'https://faucet.circle.com/';

const ExternalLink = (url: string, label: string): string =>
  `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}<img src="/assets/icons/open-in-new-tab.svg" alt="" class="external-link-icon" /></a>`;

export const FUND_PLATFORM_WALLET_PAGE: DocPage = {
  id: 'fund-platform-wallet',
  title: 'Fund your platform wallet',
  description:
    'Turn money from your sales into USDC on Ethereum, then add it to your FiatDesk balance for seller payouts.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'With Stripe, payouts usually come from money Stripe has already collected for you. FiatDesk works differently. Your seller payouts are sent from your own platform wallet, so that wallet needs enough USDC before you can pay anyone.',
        },
        {
          type: 'paragraph',
          text: `If your sales settle into a bank account or another payment service, you can use an exchange such as ${ExternalLink(
            coinbaseUrl,
            'Coinbase'
          )} or ${ExternalLink(
            krakenUrl,
            'Kraken'
          )} to buy USDC and send it to your FiatDesk wallet.`,
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'New to USDC? ',
          text: 'USDC is a digital dollar designed to stay close to $1 USD. Ethereum is the network that moves it between wallets. Your wallet address (it starts with 0x) is safe to share. Your private key and recovery phrase are not.',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Testing first? ',
          text: `In test mode on Sepolia (<code>SETTLEMENT_RAIL=onchain</code>), skip the exchange: get free test USDC from the ${ExternalLink(
            circleFaucetUrl,
            'Circle faucet'
          )} (select <strong>Ethereum Sepolia</strong>) and a little Sepolia ETH for gas from any Sepolia faucet. Never send real ETH or USDC to a test wallet. Simulated test mode needs no wallet at all; see <a href="/local-development#test-funds">Test funds</a>.`,
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '1. Decide how much USDC you need' },
        {
          type: 'paragraph',
          text: 'Start with the payouts you expect to send soon, then add a little room for changes or refunds. You do not need to move all of your sales revenue into USDC.',
        },
        {
          type: 'paragraph',
          text: 'For your first deposit, consider sending a small amount first. Once it appears in FiatDesk, you can send the rest using the same saved address.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '2. Buy USDC on an exchange' },
        {
          type: 'paragraph',
          text: 'Sign in to your exchange, add money from your bank account, and buy USDC. The exact buttons differ by exchange, but you are looking for an option named <strong>Buy</strong>, <strong>Trade</strong>, or <strong>Convert</strong>.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Check the exchange fee and any waiting period before you buy. A new bank deposit may need to clear before the exchange lets you send the USDC to another wallet.',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '3. Copy your FiatDesk deposit address',
        },
        {
          type: 'paragraph',
          text: `Open ${ExternalLink(
            dashboardBalanceUrl,
            'Balance'
          )} in the managed FiatDesk dashboard and click <strong>Add funds</strong>. Copy the deposit address shown in the panel. If you self-host FiatDesk, open the same page on your own dashboard.`,
          html: true,
        },
        {
          type: 'paragraph',
          text: `The deposit address is your default platform wallet's address. If you created the wallet during setup, it is the address you saved then. You can add wallets or choose another default under ${ExternalLink(
            dashboardSettingsUrl,
            'Settings'
          )} → Wallets.`,
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Only the default wallet counts. ',
          text: "Top-ups are counted on the default wallet only. USDC sent to your platform's other wallets, or to one removed in the last 30 days, is not added to your balance: Home and Balances show a banner until you send it on to the default wallet.",
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Check the address carefully. ',
          text: 'Crypto transfers cannot be reversed. Copy and paste the address, then compare the first and last few characters before sending.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '4. Set up the withdrawal' },
        {
          type: 'paragraph',
          text: 'Back on the exchange, choose to send or withdraw <strong>USDC</strong>. Paste your FiatDesk deposit address as the recipient.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'When the exchange asks which network to use, select <strong>Ethereum</strong>. It may also be labelled <strong>ERC-20</strong> or <strong>ETH</strong>. Do not select Base, Polygon, Arbitrum, Optimism, or another network, even though those networks also carry USDC and accept the same address.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'The network must be Ethereum. ',
          text: 'Deposits are detected on Ethereum only. USDC sent over another network does not reach your FiatDesk balance and may be hard or impossible to recover. The asset should be USDC and the withdrawal network should be Ethereum.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '5. Send the USDC' },
        {
          type: 'paragraph',
          text: 'Enter the amount, review the exchange fee, address, and network one more time, then confirm the withdrawal. Withdrawals on Ethereum can cost more than on other networks, so check the fee. Your exchange may ask for a security code or email confirmation.',
        },
        {
          type: 'paragraph',
          text: "Return to the FiatDesk Add funds panel, scroll down to the bottom and click <strong>I've sent my funds</strong>. FiatDesk will watch the wallet for the transfer.",
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '6. Wait for confirmation' },
        {
          type: 'paragraph',
          text: 'Once the exchange sends the transfer, it usually reaches FiatDesk within a few minutes, after a couple of block confirmations. The exchange may take longer to review and release a withdrawal.',
        },
        {
          type: 'paragraph',
          text: 'Once detected, the deposit is added to your available platform balance. If it does not appear, check that the exchange marks the withdrawal as complete, the network was Ethereum, and the destination matches your deposit address.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '7. Use the balance for payouts' },
        {
          type: 'paragraph',
          text: 'Your platform can now transfer funds to connected account balances and pay sellers in USDC. Keep enough USDC in the platform wallet to cover any payouts you create.',
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Keep some ETH in the wallet too. ',
          text: 'Ethereum charges a network fee, called gas, in ETH when you send payouts. Buy some ETH on the exchange and send it to the same platform wallet address on the Ethereum network. The dashboard shows the estimated fee before you sign each payout.',
        },
        {
          type: 'list',
          items: [
            {
              text: '<a href="/quickstart">Dashboard quickstart</a> - onboard a seller and send a payout',
              html: true,
            },
            {
              text: '<a href="/api-quickstart">API quickstart</a> - create transfers and payouts from your app',
              html: true,
            },
            {
              text: '<a href="/local-development#test-funds">Test funds</a> - add simulated USDC in test mode without using real money',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
