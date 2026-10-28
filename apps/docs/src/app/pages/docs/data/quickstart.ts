import { DocPage } from './types';

export const PAYMENT_LINK_QUICKSTART_PAGE: DocPage = {
  id: 'payment-link-quickstart',
  title: 'Quickstart',
  description: 'Accept your first stablecoin payment with no code.',
  sections: [
    {
      left: [
        {
          type: 'paragraph',
          text: 'If you don\'t have an account yet, <a href="https://pay.yourdomain.com">sign up</a>, then open your FiatDesk dashboard.',
          html: true,
        },
        {
          type: 'heading',
          level: 2,
          text: '1. Go to Payment Links',
        },
        {
          type: 'paragraph',
          text: 'In the sidebar, open <a href="https://pay.yourdomain.com/account/payment-links" target="_blank" rel="noopener noreferrer"><strong>Payment Links</strong><img src="/assets/icons/open-in-new-tab.svg" alt="" class="external-link-icon" /></a>.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '2. Create a payment link',
        },
        {
          type: 'paragraph',
          text: 'Click <strong>Create payment link</strong>.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '3. Add a new product',
        },
        {
          type: 'paragraph',
          text: 'Under <strong>Product</strong>, click <strong>Find or add a product…</strong>, then <strong>Add new product</strong>.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '4. Enter product details',
        },
        {
          type: 'paragraph',
          text: 'Enter a <strong>Name</strong> and <strong>Amount</strong>, then click <strong>Save</strong>.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '5. Create the link',
        },
        {
          type: 'paragraph',
          text: 'Click <strong>Create link</strong>.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '6. Share the link',
        },
        {
          type: 'paragraph',
          text: 'Click the URL to copy it (<strong>Copy payment link URL</strong>). Share it by email, text, or on your site.',
          html: true,
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '7. Accept a payment',
        },
        {
          type: 'paragraph',
          text: 'When a customer opens the link, they see your product and pay in USDC. In test mode, Checkout shows a simulated wallet you can approve without connecting a real wallet. In live mode, the customer connects an Ethereum wallet such as MetaMask and signs one USDC authorization. The API relays it and pays the network gas, so the customer needs USDC but no ETH.',
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
              text: '<a href="/checkout-api-quickstart">Checkout API quickstart</a> - accept payments from your app',
              html: true,
            },
            {
              text: '<a href="/webhooks">Webhooks</a> - get notified when a payment completes',
              html: true,
            },
            {
              text: '<a href="/quickstart">Quickstart</a> - onboard and pay out your first seller',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
