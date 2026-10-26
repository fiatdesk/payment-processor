import { DocPage } from './types';

export const IDENTITY_VERIFICATION_PAGE: DocPage = {
  id: 'identity-verification',
  title: 'Identity Verification (KYC)',
  description:
    'Review suspicious accounts and require identity checks before sellers receive larger payouts.',
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'How identity checks work' },
        {
          type: 'paragraph',
          text: "Zoneless gives marketplaces two levels of protection. The first is a set of lightweight checks that run whenever a connected account signs up. These checks look for suspicious details, such as a phone number used by several accounts or a mismatch between the seller's country, address, and IP address.",
        },
        {
          type: 'paragraph',
          text: 'Flagged accounts appear as <strong>In review</strong> in your connected accounts dashboard. Their payouts stay enabled, so you can review the details and decide whether to pause payouts or reject the account.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Optionally, for stronger checks, Zoneless connects to <a href="https://didit.me/pricing/" target="_blank" rel="noopener noreferrer">Didit</a>. Didit asks the seller for an identity document and a selfie, then checks that the document is valid and belongs to them. Didit currently includes 500 checks per month for free. Additional checks cost $0.33 each.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'A flag is not proof of fraud. ',
          text: 'Check the account before taking action. Legitimate sellers can have unusual or mismatched details.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/account-review.webp',
          alt: 'A connected account marked as in review',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: 'Guide: Connect Didit for full KYC',
        },
        {
          type: 'paragraph',
          text: 'Connect one Didit workspace to your Zoneless instance. Zoneless starts a check automatically when a seller reaches one of the payout limits you set.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '1. Create a Didit account' },
        {
          type: 'paragraph',
          text: 'Go to <a href="https://didit.me/" target="_blank" rel="noopener noreferrer">Didit</a> and create an account.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-1.webp',
          alt: 'Didit sign-up page',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '2. Copy your API key' },
        {
          type: 'paragraph',
          text: 'In Didit, open the <strong>API keys</strong> page and copy your API key.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-2.webp',
          alt: 'API key page in Didit',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '3. Add the API key to Zoneless' },
        {
          type: 'paragraph',
          text: 'In Zoneless, open <strong>Settings</strong>, then <strong>Identity</strong>. Paste the key into <strong>Didit API Key</strong>.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Keep your API key private. ',
          text: 'Treat it like a password. Do not add it to client-side code or share it publicly.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-3.webp',
          alt: 'Didit API key field in Zoneless',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '4. Copy the workflow ID' },
        {
          type: 'paragraph',
          text: 'Return to Didit and open <strong>Workflows</strong>. Find the <strong>Free KYC</strong> workflow and click the copy button next to its ID.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-4.webp',
          alt: 'Free KYC workflow in Didit',
        },
      ],
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '5. Add the workflow ID to Zoneless',
        },
        {
          type: 'paragraph',
          text: 'Paste the ID into the <strong>Workflow ID</strong> field in your Zoneless Identity settings.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-5.webp',
          alt: 'Workflow ID field in Zoneless',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '6. Create a webhook in Didit' },
        {
          type: 'paragraph',
          text: 'In Didit, open <strong>Webhooks</strong> and click <strong>Add destination</strong>. Give the webhook a name, then paste in the webhook URL shown in your Zoneless Identity settings.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'If you use Zoneless Cloud, the URL is <code>https://api.zoneless.com/v1/identity/webhooks/didit</code>. If you self-host, use the same path on your own API domain.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Subscribe to the <code>status.updated</code> event.',
          html: true,
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-6.webp',
          alt: 'Add webhook destination form in Didit',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '7. Save the webhook secret' },
        {
          type: 'paragraph',
          text: 'Create the webhook, then copy its secret. Return to Zoneless and paste it into <strong>Webhook secret</strong>.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'The secret lets Zoneless confirm that identity updates really came from Didit.',
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-7.webp',
          alt: 'Webhook secret field in Zoneless',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '8. Set your payout thresholds' },
        {
          type: 'paragraph',
          text: 'Choose how much a seller can receive before they must complete KYC. For example, enter <strong>100</strong> to require a check when a seller reaches $100 in payouts.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'You can also add different thresholds for individual countries. For example, you could require sellers in Spain to complete KYC after $10 in payouts while using the default threshold everywhere else.',
        },
        {
          type: 'list',
          items: [
            {
              text: 'Leave a threshold blank to disable automatic KYC checks.',
            },
            {
              text: 'Set a threshold to <code>0</code> to require KYC before the first payout.',
              html: true,
            },
          ],
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-8.webp',
          alt: 'Default and country payout thresholds in Zoneless',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'What happens next' },
        {
          type: 'paragraph',
          text: 'When a seller reaches a threshold, Zoneless pauses their payouts and shows a notification in their Express Dashboard. The seller follows the link to Didit, then uses their phone to upload a valid identity document and complete a selfie check.',
        },
        {
          type: 'paragraph',
          text: "Didit sends the result to Zoneless through the webhook. Once the check is approved, Zoneless enables the seller's payouts again.",
        },
      ],
      right: [
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-10.webp',
          alt: 'Identity check notification in the seller Express Dashboard',
        },
        {
          type: 'image',
          src: '/assets/images/screenshots/didit/identity-9.webp',
          alt: 'Didit onboarding start',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'Next steps' },
        {
          type: 'list',
          items: [
            {
              text: '<a href="/connected-accounts">Connected accounts</a> - manage your marketplace sellers',
              html: true,
            },
            {
              text: '<a href="/webhooks">Webhooks</a> - receive updates from Zoneless',
              html: true,
            },
            {
              text: '<a href="/payouts">Payouts</a> - pay connected accounts in USDC',
              html: true,
            },
            {
              text: '<a href="https://zoneless.com/blog/protect-your-marketplace-with-kyc-checks">How to run KYC checks on marketplace sellers</a> - learn how to choose a KYC policy',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
