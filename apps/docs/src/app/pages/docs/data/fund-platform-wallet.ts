import { DocPage } from './types';

const dashboardBalanceUrl = 'https://dashboard.zoneless.com/account/balance';
const dashboardSettingsUrl = 'https://dashboard.zoneless.com/account/settings';
const coinbaseUrl = 'https://www.coinbase.com/';
const krakenUrl = 'https://www.kraken.com/';

const ExternalLink = (url: string, label: string): string =>
  `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}<img src="/assets/icons/open-in-new-tab.svg" alt="" class="external-link-icon" /></a>`;

export const FUND_PLATFORM_WALLET_PAGE: DocPage = {
  id: 'fund-platform-wallet',
  title: 'Fund your platform wallet',
  description:
    'Turn money from your sales into USDC on Solana, then add it to your Zoneless balance for seller payouts.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'With Stripe, payouts usually come from money Stripe has already collected for you. Zoneless works differently. Your seller payouts are sent from your own platform wallet, so that wallet needs enough USDC before you can pay anyone.',
        },
        {
          type: 'paragraph',
          text: `If your sales settle into a bank account or another payment service, you can use an exchange such as ${ExternalLink(
            coinbaseUrl,
            'Coinbase'
          )} or ${ExternalLink(
            krakenUrl,
            'Kraken'
          )} to buy USDC and send it to your Zoneless wallet.`,
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'New to USDC? ',
          text: 'USDC is a digital dollar designed to stay close to $1 USD. Solana is the network that moves it between wallets. Your wallet address, also called a public key, is safe to share. Your secret key is not.',
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
          text: 'For your first deposit, consider sending a small amount first. Once it appears in Zoneless, you can send the rest using the same saved address.',
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
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/top-ups/top-up-1.webp',
          alt: 'Buy USDC on an exchange',
          caption: 'Buy USDC using the money you added to the exchange.',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '3. Copy your Zoneless deposit address',
        },
        {
          type: 'paragraph',
          text: `Open ${ExternalLink(
            dashboardBalanceUrl,
            'Balance'
          )} in the managed Zoneless dashboard and click <strong>Add funds</strong>. Copy the deposit address shown in the panel. If you self-host Zoneless, open the same page on your own dashboard.`,
          html: true,
        },
        {
          type: 'paragraph',
          text: `The deposit address is your platform wallet's public key. If you created the wallet in your browser, it is the public key you saved during setup. You can view or change the platform wallet under ${ExternalLink(
            dashboardSettingsUrl,
            'Settings'
          )}.`,
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Check the address carefully. ',
          text: 'Crypto transfers cannot be reversed. Copy and paste the address, then compare the first and last few characters before sending.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-1.webp',
          alt: 'Add funds panel showing the platform deposit address',
          caption: 'Copy the deposit address from the Add funds panel.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '4. Set up the withdrawal' },
        {
          type: 'paragraph',
          text: 'Back on the exchange, choose to send or withdraw <strong>USDC</strong>. Paste your Zoneless deposit address as the recipient.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'When the exchange asks which network to use, select <strong>Solana</strong>. It may also be labelled <strong>SOL</strong> or <strong>SPL</strong>. Do not select Ethereum, Base, Polygon, or another network, even though those networks also support USDC.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'The network must be Solana. ',
          text: 'Sending USDC over the wrong network can permanently lose the funds. The asset should be USDC and the withdrawal network should be Solana.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/top-ups/top-up-2.webp',
          alt: 'USDC withdrawal with Solana selected as the network',
          caption: 'Select USDC as the asset and Solana as the network.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '5. Send the USDC' },
        {
          type: 'paragraph',
          text: 'Enter the amount, review the exchange fee, address, and network one more time, then confirm the withdrawal. Your exchange may ask for a security code or email confirmation.',
        },
        {
          type: 'paragraph',
          text: "Return to the Zoneless Add funds panel, scroll down to the bottom and click <strong>I've sent my funds</strong>. Zoneless will watch the wallet for the transfer.",
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/top-ups/top-up-3.webp',
          alt: 'I have sent my funds button in Zoneless',
          caption:
            'Tell Zoneless after you confirm the withdrawal at the exchange.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '6. Wait for confirmation' },
        {
          type: 'paragraph',
          text: 'A Solana transfer usually reaches Zoneless in about 10 seconds after the exchange sends it. The exchange may take longer to review and release a withdrawal.',
        },
        {
          type: 'paragraph',
          text: 'Once detected, the deposit is added to your available platform balance. If it does not appear, check that the exchange marks the withdrawal as complete, the network was Solana, and the destination matches your deposit address.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/top-ups/top-up-4.webp',
          alt: 'Confirmed USDC deposit in the platform balance',
          caption:
            'The USDC is ready when it appears in your available balance.',
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
          title: 'Keep a little SOL in the wallet too. ',
          text: 'Solana charges a small network fee when you send payouts. Buy a small amount of SOL on the exchange and send it to the same platform wallet address using the Solana network.',
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
