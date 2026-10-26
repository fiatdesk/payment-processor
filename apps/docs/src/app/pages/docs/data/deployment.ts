import { DocPage } from './types';

export const DEPLOYMENT_PAGE: DocPage = {
  id: 'deployment',
  title: 'Deployment',
  description:
    'Deploy a self-hosted Zoneless instance to a Linux server with Docker.',
  sections: [
    {
      left: [
        { type: 'heading', level: 2, text: 'Choose a VPS provider' },
        {
          type: 'paragraph',
          text: 'Zoneless runs on any Linux server with Docker. These steps use Ubuntu 24.04.',
        },
        {
          type: 'list',
          items: [
            {
              text: '<a href="https://www.linode.com/" target="_blank" rel="noopener noreferrer">Linode</a>',
              html: true,
            },
            {
              text: '<a href="https://www.digitalocean.com/" target="_blank" rel="noopener noreferrer">DigitalOcean</a>',
              html: true,
            },
            {
              text: '<a href="https://www.hetzner.com/cloud" target="_blank" rel="noopener noreferrer">Hetzner Cloud</a>',
              html: true,
            },
          ],
        },
        {
          type: 'callout',
          variant: 'info',
          title: 'Server size. ',
          text: 'Use at least 2 GB of RAM for the API, dashboard, and database.',
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '1. Create a server' },
        {
          type: 'list',
          items: [
            { text: '<strong>Image:</strong> Ubuntu 24.04 LTS', html: true },
            {
              text: '<strong>Plan:</strong> Shared CPU with at least 2GB RAM',
              html: true,
            },
            {
              text: '<strong>Region:</strong> Pick the closest to your users',
              html: true,
            },
            {
              text: '<strong>Authentication:</strong> Add an SSH key',
              html: true,
            },
          ],
        },
        {
          type: 'paragraph',
          text: 'Copy the server IP address after it finishes booting.',
          html: true,
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '2. SSH into your server' },
        {
          type: 'paragraph',
          text: 'Connect using the SSH key added when you created the server.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Connect',
          tabs: [
            {
              id: 'ssh',
              label: 'Terminal',
              code: `ssh root@YOUR_IP_ADDRESS`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '3. Install Docker' },
        {
          type: 'paragraph',
          text: 'Install Docker using its official convenience script.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Install Docker',
          tabs: [
            {
              id: 'bash',
              label: 'Terminal',
              code: `curl -fsSL https://get.docker.com | sh`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '4. Clone Zoneless' },
        {
          type: 'paragraph',
          text: 'Clone the repository and navigate into it.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Clone',
          tabs: [
            {
              id: 'bash',
              label: 'Terminal',
              code: `git clone https://github.com/zonelessdev/zoneless.git
cd zoneless`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '5. Configure environment' },
        {
          type: 'paragraph',
          text: 'Copy the production example and set your public dashboard URL, app secret, network, and tenancy mode. The example below uses mainnet. Set <code>LIVEMODE=false</code> for test mode (simulated funds by default). To test real Devnet transactions instead, also set <code>SETTLEMENT_RAIL=onchain</code>. See <a href="/environment-variables">Environment variables</a> for optional settings.',
          html: true,
        },
        {
          type: 'callout',
          variant: 'warning',
          title: 'Generate a strong secret. ',
          text: 'Use <code>openssl rand -hex 64</code> to generate a cryptographically secure value for <code>APP_SECRET</code>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Copy the example file',
          tabs: [
            {
              id: 'bash',
              label: 'Terminal',
              code: `cp .env.production.example .env.production
nano .env.production`,
            },
          ],
        },
        {
          type: 'code',
          title: '.env.production',
          tabs: [
            {
              id: 'env',
              label: '.env.production',
              code: `DASHBOARD_URL=http://YOUR_IP_ADDRESS
APP_SECRET=your_generated_secret_here
LIVEMODE=true
SINGLE_TENANT=true`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '6. Start Zoneless' },
        {
          type: 'paragraph',
          text: 'Build and start the containers. The first build may take a few minutes.',
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Start',
          tabs: [
            {
              id: 'bash',
              label: 'Terminal',
              code: `docker compose --env-file .env.production up -d --build`,
            },
          ],
        },
      ],
    },
    {
      left: [
        { type: 'heading', level: 2, text: '7. Check the deployment' },
        {
          type: 'paragraph',
          text: 'Check the API using the server IP, then open <code>http://YOUR_IP_ADDRESS/setup</code> and complete the <a href="/self-hosting">setup wizard</a>.',
          html: true,
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Verify',
          tabs: [
            {
              id: 'bash',
              label: 'Terminal',
              code: `curl http://YOUR_IP_ADDRESS/api/health`,
            },
          ],
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
              text: '<strong>Backups:</strong> Back up MongoDB and test restoring it before you need it.',
              html: true,
            },
            {
              text: '<strong>Monitoring:</strong> Check <code>/api/health</code>, disk space, and container logs.',
              html: true,
            },
            {
              text: '<strong>Updates:</strong> Review release notes, pull the new version, and rebuild the containers.',
              html: true,
            },
          ],
        },
      ],
    },
  ],
};
