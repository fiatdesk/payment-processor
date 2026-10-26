import { DocPage } from './types';

export const QUICKSTART_PAGE: DocPage = {
  id: 'quickstart',
  title: 'Payouts Quickstart',
  description:
    'Onboard a seller and send their first USDC payout with no code.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'Start by <a href="https://zoneless.com/login?view=signup">creating a Zoneless account</a> and opening your dashboard.',
          html: true,
        },
        {
          type: 'heading',
          level: 2,
          text: '1. Go to Connected accounts',
        },
        {
          type: 'paragraph',
          text: 'In the dashboard sidebar, open <a href="https://dashboard.zoneless.com/account/connected-accounts" target="_blank" rel="noopener noreferrer"><strong>Connected accounts</strong><img src="/assets/icons/open-in-new-tab.svg" alt="" class="external-link-icon" /></a>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-2.webp',
          alt: 'Connected accounts in the dashboard sidebar',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '2. Create an account',
        },
        {
          type: 'paragraph',
          text: 'Click <strong>+ Create</strong> in the top-right corner.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-3.webp',
          alt: 'Create connected account button',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '3. Add the account details',
        },
        {
          type: 'paragraph',
          text: 'Edit any details you want to include for the seller, then click <strong>Create</strong>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-4.webp',
          alt: 'Connected account details',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '4. Share the onboarding link',
        },
        {
          type: 'paragraph',
          text: 'Copy the onboarding link and send it to the seller.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-5.webp',
          alt: 'Connected account onboarding link',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '5. Let the seller complete onboarding',
        },
        {
          type: 'paragraph',
          text: 'The seller opens the link, adds their details, and connects the Solana wallet where they want to receive payouts. If you want to test this yourself, open the link in an incognito window.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-6.webp',
          alt: 'Seller onboarding form',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '6. Fund your platform wallet',
        },
        {
          type: 'paragraph',
          text: 'In test mode, open <strong>Balance</strong>, click <strong>Add funds</strong>, and choose <strong>Add test USDC</strong>. In live mode, send real USDC to your platform wallet \u2014 see <a href="/fund-platform-wallet" target="_blank" rel="noopener noreferrer"><strong>Fund your platform wallet</strong><img src="/assets/icons/open-in-new-tab.svg" alt="" class="external-link-icon" /></a>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-1.webp',
          alt: 'Platform wallet balance',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '7. Open the connected account',
        },
        {
          type: 'paragraph',
          text: 'Once the seller has finished onboarding, return to <a href="https://dashboard.zoneless.com/account/connected-accounts" target="_blank" rel="noopener noreferrer"><strong>Connected accounts</strong><img src="/assets/icons/open-in-new-tab.svg" alt="" class="external-link-icon" /></a> and click their account.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-7.webp',
          alt: 'Onboarded seller in the connected accounts list',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '8. Open the transfer form',
        },
        {
          type: 'paragraph',
          text: 'Click <strong>Add funds</strong> to open the transfer form.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-8.webp',
          alt: 'Add funds button on a connected account',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '9. Transfer funds',
        },
        {
          type: 'paragraph',
          text: "Enter the amount to add to the seller's balance, check the confirmation box, and click <strong>Send</strong>.",
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-9.webp',
          alt: 'Transfer amount for a connected account',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '10. Open the payout form',
        },
        {
          type: 'paragraph',
          text: 'Click <strong>Pay out account balance</strong>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-10.webp',
          alt: 'Pay out account balance button',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '11. Enter the payout amount',
        },
        {
          type: 'paragraph',
          text: "Enter the amount to send from the seller's balance to their wallet.",
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-11.webp',
          alt: 'Payout amount for a connected account',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '12. Sign and send the payout',
        },
        {
          type: 'paragraph',
          text: 'Sign the transaction with your wallet private key or your browser wallet. Check <strong>Confirm payout</strong>, then click <strong>Send</strong>.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Keep your private key safe. ',
          text: 'Only enter it in your own Zoneless instance. Never share it or store it in client-side code.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/connect-quickstart/connect-12.webp',
          alt: 'Sign and confirm a connected account payout',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: 'Done',
        },
        {
          type: 'paragraph',
          text: 'The seller should now have the USDC in their wallet.',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: 'Next steps',
        },
        {
          type: 'list',
          items: [
            {
              text: '<a href="/api-quickstart">API quickstart</a> - onboard and pay sellers from your app',
              html: true,
            },
            {
              text: '<a href="/connected-accounts">Connected accounts</a> - learn how platform requests work',
              html: true,
            },
            {
              text: '<a href="/identity-verification">Identity verification</a> - require KYC before payouts',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
