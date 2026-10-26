import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GetDocRoutes,
  type DocRoute,
} from '../src/app/pages/docs/docs-catalog';
import {
  GeneratePagesMarkdown,
  HtmlToText,
} from '../src/app/pages/docs/docs-markdown';

const defaultSiteUrl = 'https://docs.zoneless.com';

export interface AgentDocsOptions {
  outputDir: string;
  siteUrl?: string;
  routes?: DocRoute[];
}

export function BuildLlmsTxt(
  routes: DocRoute[],
  siteUrl = defaultSiteUrl
): string {
  const groups = new Map<string, DocRoute[]>();
  for (const route of routes) {
    const group = groups.get(route.category) ?? [];
    group.push(route);
    groups.set(route.category, group);
  }

  let contents = [
    '# Zoneless',
    '',
    '> Open-source payments, checkout, subscriptions, and marketplace payouts using USDC on Solana.',
    '',
    'Use these canonical Markdown documents when integrating with Zoneless.',
    '',
    '',
  ].join('\n');

  for (const [category, categoryRoutes] of groups) {
    contents += `## ${category}\n\n`;
    for (const route of categoryRoutes) {
      const url = `${siteUrl}${route.route}.md`;
      contents += `- [${route.title}](${url}): ${HtmlToText(
        route.description
      )}\n`;
    }
    contents += '\n';
  }

  return contents.trimEnd() + '\n';
}

export async function GenerateAgentDocs({
  outputDir,
  siteUrl = defaultSiteUrl,
  routes = GetDocRoutes(),
}: AgentDocsOptions): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });

  for (const route of routes) {
    const relativeFile = `${route.route.replace(/^\/+/, '')}.md`;
    const outputFile = path.join(outputDir, relativeFile);
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    await fs.writeFile(
      outputFile,
      GeneratePagesMarkdown(route.title, route.description, route.pages, {
        includeAllCodeTabs: true,
      })
    );
  }

  await fs.writeFile(
    path.join(outputDir, 'llms.txt'),
    BuildLlmsTxt(routes, siteUrl)
  );
}

function ParseOutputDir(argumentsList: string[]): string {
  const outputIndex = argumentsList.indexOf('--output');
  if (outputIndex === -1) {
    return path.resolve('dist/apps/docs/browser');
  }

  const outputDir = argumentsList[outputIndex + 1];
  if (!outputDir) {
    throw new Error('--output requires a directory');
  }
  return path.resolve(outputDir);
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (currentFile === invokedFile) {
  const outputDir = ParseOutputDir(process.argv.slice(2));
  GenerateAgentDocs({ outputDir })
    .then(() => {
      process.stdout.write(`Generated agent documentation in ${outputDir}\n`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `Failed to generate agent documentation: ${message}\n`
      );
      process.exitCode = 1;
    });
}
