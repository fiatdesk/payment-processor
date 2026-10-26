import { DocSection } from './types';

export const GET_STARTED_SECTION: DocSection = {
  id: 'get-started',
  title: 'Get started',
  children: [
    {
      id: 'payment-link-quickstart',
      title: 'Quickstart',
      children: [],
    },
    {
      id: 'checkout-api-quickstart',
      title: 'API Quickstart',
      children: [],
    },
    { id: 'authentication', title: 'Authentication', children: [] },
    { id: 'migrate-from-stripe', title: 'Migrate from Stripe', children: [] },
    { id: 'platform-dashboard', title: 'Platform Dashboard', children: [] },
  ],
};

export const SELF_HOSTING_SECTION: DocSection = {
  id: 'self-hosting-section',
  title: 'Self-hosting',
  children: [
    { id: 'self-hosting', title: 'Self-hosting', children: [] },
    {
      id: 'environment-variables',
      title: 'Environment variables',
      children: [],
    },
    { id: 'deployment', title: 'Deployment', children: [] },
    { id: 'local-development', title: 'Local Development', children: [] },
  ],
};

export const CONNECT_GUIDES_SECTION: DocSection = {
  id: 'connect-guides',
  title: 'Marketplaces',
  children: [
    { id: 'quickstart', title: 'Payouts Quickstart', children: [] },
    { id: 'api-quickstart', title: 'Payouts API Quickstart', children: [] },
    { id: 'connected-accounts', title: 'Connected Accounts', children: [] },
    {
      id: 'fund-platform-wallet',
      title: 'Fund your platform wallet',
      children: [],
    },
    {
      id: 'identity-verification',
      title: 'Identity Verification (KYC)',
      children: [],
    },
  ],
};

export const DEVELOPMENT_SECTION: DocSection = {
  id: 'development',
  title: 'Development',
  children: [
    { id: 'webhooks', title: 'Webhooks', children: [] },
    { id: 'errors', title: 'Errors', children: [] },
    { id: 'idempotent-requests', title: 'Idempotent Requests', children: [] },
    { id: 'pagination', title: 'Pagination', children: [] },
    { id: 'expanding-responses', title: 'Expanding Responses', children: [] },
  ],
};

export const AGENT_DOCS_SECTION: DocSection = {
  id: 'agent-docs',
  title: 'Agents Docs',
  children: [
    {
      id: 'agent-payments-quickstart',
      title: 'Agent Payments Quickstart',
      children: [],
    },
    {
      id: 'agent-marketplace-quickstart',
      title: 'Agent Marketplace Quickstart',
      children: [],
    },
  ],
};

/** Guide sidebar sections, in display order. */
export const PRIMARY_GUIDE_SECTIONS: DocSection[] = [
  GET_STARTED_SECTION,
  CONNECT_GUIDES_SECTION,
  SELF_HOSTING_SECTION,
  DEVELOPMENT_SECTION,
];

export const GUIDE_SECTIONS: DocSection[] = [
  ...PRIMARY_GUIDE_SECTIONS,
  AGENT_DOCS_SECTION,
];
