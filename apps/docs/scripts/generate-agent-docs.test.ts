import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  docSections,
  GetDocRoutes,
  type DocRoute,
} from '../src/app/pages/docs/docs-catalog';
import type { DocPage } from '../src/app/pages/docs/data';
import {
  GeneratePageMarkdown,
  HtmlToText,
} from '../src/app/pages/docs/docs-markdown';
import { BuildLlmsTxt, GenerateAgentDocs } from './generate-agent-docs';

const testPage: DocPage = {
  id: 'create',
  title: 'Create a product',
  description:
    'Create a <strong>product</strong>. <a href="/products">Read more</a>.',
  sections: [
    {
      left: [
        {
          type: 'attributes',
          attributes: [
            {
              name: 'metadata',
              type: 'object',
              description: 'Attached metadata.',
              children: [
                {
                  name: 'owner',
                  type: 'string',
                  description: 'The owner name.',
                  required: true,
                },
              ],
            },
          ],
        },
      ],
      right: [
        {
          type: 'code',
          title: 'Request',
          tabs: [
            { id: 'curl', label: 'cURL', code: 'curl /v1/products' },
            {
              id: 'node',
              label: 'Node.js',
              code: 'zoneless.products.create({});',
            },
          ],
        },
      ],
    },
  ],
};

const testRoute: DocRoute = {
  route: '/products/create',
  title: testPage.title,
  description: testPage.description,
  category: 'Products',
  pages: [testPage],
};

test('GeneratePageMarkdown serializes nested attributes, links, and code', () => {
  const markdown = GeneratePageMarkdown(testPage, {
    includeAllCodeTabs: true,
  });

  assert.match(markdown, /\*\*product\*\*/);
  assert.match(markdown, /\[Read more\]\(\/products\)/);
  assert.match(markdown, /`metadata\.owner` \(string, required\)/);
  assert.match(markdown, /### Request — cURL/);
  assert.match(markdown, /### Request — Node\.js/);
  assert.match(markdown, /curl \/v1\/products/);
  assert.match(markdown, /zoneless\.products\.create/);
});

test('BuildLlmsTxt uses canonical Markdown URLs and plain descriptions', () => {
  const contents = BuildLlmsTxt([testRoute]);

  assert.match(contents, /## Products/);
  assert.match(contents, /when integrating with Zoneless\.\n\n## Products/);
  assert.match(
    contents,
    /\[Create a product\]\(https:\/\/docs\.zoneless\.com\/products\/create\.md\)/
  );
  assert.doesNotMatch(contents, /<strong>|<a /);
  assert.equal(HtmlToText(testPage.description).includes('**product**'), true);
});

test('llms.txt includes both agent quickstarts', () => {
  const contents = BuildLlmsTxt(GetDocRoutes());

  assert.match(
    contents,
    /\[Agent Payments Quickstart\]\(https:\/\/docs\.zoneless\.com\/agent-payments-quickstart\.md\)/
  );
  assert.match(
    contents,
    /\[Agent Marketplace Quickstart\]\(https:\/\/docs\.zoneless\.com\/agent-marketplace-quickstart\.md\)/
  );
});

test('agent guides use a dedicated final sidebar section', () => {
  const getStarted = docSections.find(
    (section) => section.id === 'get-started'
  );
  const agentDocs = docSections.at(-1);

  assert.deepEqual(
    getStarted?.children?.map((child) => child.id),
    [
      'payment-link-quickstart',
      'checkout-api-quickstart',
      'authentication',
      'migrate-from-stripe',
      'platform-dashboard',
    ]
  );
  assert.equal(agentDocs?.id, 'agent-docs');
  assert.deepEqual(
    agentDocs?.children?.map((child) => child.id),
    ['agent-payments-quickstart', 'agent-marketplace-quickstart']
  );
});

test('GenerateAgentDocs emits the marketplace agent bootstrap document', async (context) => {
  const outputDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'zoneless-marketplace-agent-docs-')
  );
  context.after(() => fs.rm(outputDir, { recursive: true, force: true }));

  const marketplaceRoute = GetDocRoutes().find(
    (route) => route.route === '/agent-marketplace-quickstart'
  );
  assert.ok(marketplaceRoute);

  await GenerateAgentDocs({ outputDir, routes: [marketplaceRoute] });

  const markdown = await fs.readFile(
    path.join(outputDir, 'agent-marketplace-quickstart.md'),
    'utf8'
  );
  const llmsTxt = await fs.readFile(path.join(outputDir, 'llms.txt'), 'utf8');

  assert.match(markdown, /^# Agent Marketplace Quickstart/);
  assert.match(markdown, /agent setup \\\n {2}--platform-name/);
  assert.match(markdown, /--skill marketplace \\\n {2}--json/);
  assert.match(markdown, /`--new-platform`/);
  assert.match(markdown, /`skill_path`/);
  assert.match(markdown, /\[API Quickstart\]\(\/api-quickstart\)/);
  assert.match(markdown, /https:\/\/api-test\.zoneless\.com/);
  assert.match(markdown, /https:\/\/api\.zoneless\.com/);
  assert.match(markdown, /Assume no crypto knowledge/);
  assert.match(markdown, /USDC is a digital dollar/);
  assert.match(markdown, /fake USDC/);
  assert.match(markdown, /`\.zoneless\/project\.json`/);
  assert.match(markdown, /`zoneless auth reconnect --json`/);
  assert.match(markdown, /`zoneless env sync --include-wallet --json`/);
  assert.match(markdown, /`payouts\.processAll\(\)`/);
  assert.match(markdown, /broadcast response is lost/);
  assert.match(markdown, /do not add Solana packages/);
  assert.match(markdown, /separate charges and transfers/);
  assert.match(markdown, /destination charges/);
  assert.match(markdown, /Add test USDC/);
  assert.match(markdown, /test_helpers\/treasury\/topups/);
  assert.match(markdown, /\[Local Development\]\(\/local-development\)/);
  assert.match(markdown, /does not need a wallet, faucet, or Devnet/);
  assert.match(markdown, /Do not assume create returns/);
  assert.match(
    markdown,
    /\[Fund your platform wallet\]\(\/fund-platform-wallet\)/
  );
  assert.match(
    markdown,
    /enough USDC for seller payouts and a small amount of SOL/
  );
  assert.match(
    llmsTxt,
    /https:\/\/docs\.zoneless\.com\/agent-marketplace-quickstart\.md/
  );
});

test('GenerateAgentDocs maps documentation routes to files', async (context) => {
  const outputDir = await fs.mkdtemp(
    path.join(os.tmpdir(), 'zoneless-agent-docs-')
  );
  context.after(() => fs.rm(outputDir, { recursive: true, force: true }));

  await GenerateAgentDocs({ outputDir, routes: [testRoute] });

  const markdown = await fs.readFile(
    path.join(outputDir, 'products/create.md'),
    'utf8'
  );
  const llmsTxt = await fs.readFile(path.join(outputDir, 'llms.txt'), 'utf8');

  assert.match(markdown, /^# Create a product/);
  assert.match(llmsTxt, /\/products\/create\.md/);
});
