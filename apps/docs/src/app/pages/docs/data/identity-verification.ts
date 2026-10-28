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
          text: "FiatDesk gives marketplaces two levels of protection. The first is a set of lightweight checks that run whenever a connected account signs up. These checks look for suspicious details, such as a phone number used by several accounts or a mismatch between the seller's country, address, and IP address.",
        },
        {
          type: 'paragraph',
          text: 'Flagged accounts appear as <strong>In review</strong> in your connected accounts dashboard. Their payouts stay enabled, so you can review the details and decide whether to pause payouts or reject the account.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Optionally, for stronger checks, FiatDesk connects to <a href="https://didit.me/pricing/" target="_blank" rel="noopener noreferrer">Didit</a>. Didit asks the seller for an identity document and a selfie, then checks that the document is valid and belongs to them. Didit currently includes 500 checks per month for free. Additional checks cost $0.33 each.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'A flag is not proof of fraud. ',
          text: 'Check the account before taking action. Legitimate sellers can have unusual or mismatched details.',
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
          text: 'Connect one Didit workspace to your FiatDesk instance. FiatDesk starts a check automatically when a seller reaches one of the payout limits you set.',
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
    },
    {
      left: [
        { type: 'heading', level: 2, text: '3. Add the API key to FiatDesk' },
        {
          type: 'paragraph',
          text: 'In FiatDesk, open <strong>Settings</strong>, then <strong>Identity</strong>. Paste the key into <strong>Didit API Key</strong>.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Keep your API key private. ',
          text: 'Treat it like a password. Do not add it to client-side code or share it publicly.',
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
    },
    {
      left: [
        {
          type: 'heading',
          level: 2,
          text: '5. Add the workflow ID to FiatDesk',
        },
        {
          type: 'paragraph',
          text: 'Paste the ID into the <strong>Workflow ID</strong> field in your FiatDesk Identity settings.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '6. Create a webhook in Didit' },
        {
          type: 'paragraph',
          text: 'In Didit, open <strong>Webhooks</strong> and click <strong>Add destination</strong>. Give the webhook a name, then paste in the webhook URL shown in your FiatDesk Identity settings.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'If you use FiatDesk Cloud, the URL is <code>https://api.yourdomain.com/v1/identity/webhooks/didit</code>. If you self-host, use the same path on your own API domain.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'Subscribe to the <code>status.updated</code> event.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '7. Save the webhook secret' },
        {
          type: 'paragraph',
          text: 'Create the webhook, then copy its secret. Return to FiatDesk and paste it into <strong>Webhook secret</strong>.',
          html: true,
        },
        {
          type: 'paragraph',
          text: 'The secret lets FiatDesk confirm that identity updates really came from Didit.',
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
    },
    {
      left: [
        { type: 'heading', level: 2, text: 'What happens next' },
        {
          type: 'paragraph',
          text: 'When a seller reaches a threshold, FiatDesk pauses their payouts and shows a notification in their Express Dashboard. The seller follows the link to Didit, then uses their phone to upload a valid identity document and complete a selfie check.',
        },
        {
          type: 'paragraph',
          text: "Didit sends the result to FiatDesk through the webhook. Once the check is approved, FiatDesk enables the seller's payouts again.",
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
              text: '<a href="/webhooks">Webhooks</a> - receive updates from FiatDesk',
              html: true,
            },
            {
              text: '<a href="/payouts">Payouts</a> - pay connected accounts in USDC',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
