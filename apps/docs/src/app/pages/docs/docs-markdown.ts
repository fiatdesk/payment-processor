import type {
  Attribute,
  DocPage,
  LeftContentBlock,
  RightContentBlock,
} from './data';

export interface MarkdownOptions {
  includeAllCodeTabs?: boolean;
  preferredCodeTab?: string;
}

export function GeneratePagesMarkdown(
  title: string,
  description: string,
  pages: DocPage[],
  options: MarkdownOptions = {}
): string {
  if (pages.length === 1) {
    return GeneratePageMarkdown(pages[0], options);
  }

  let markdown = `# ${title}\n\n${HtmlToText(description)}\n\n`;
  for (const page of pages) {
    markdown += GeneratePageMarkdown(page, options).replace(/^# /, '## ');
    markdown += '\n';
  }

  return markdown.trimEnd() + '\n';
}

export function GeneratePageMarkdown(
  page: DocPage,
  options: MarkdownOptions = {}
): string {
  let markdown = `# ${page.title}\n\n`;
  markdown += `${HtmlToText(page.description)}\n\n`;

  if (page.endpoints && page.endpoints.length > 0) {
    markdown += '## Endpoints\n\n';
    for (const endpoint of page.endpoints) {
      const label = endpoint.title ? `${endpoint.title}: ` : '';
      markdown += `- ${label}${endpoint.method} ${endpoint.path}\n`;
    }
    markdown += '\n';
  }

  if (page.events && page.events.length > 0) {
    markdown += '## Events\n\n';
    for (const event of page.events) {
      markdown += `- \`${event.name}\`\n  ${HtmlToText(event.description)}\n\n`;
    }
  }

  for (const section of page.sections) {
    for (const block of section.left) {
      markdown += LeftBlockToMarkdown(block);
    }
    for (const block of section.right ?? []) {
      markdown += RightBlockToMarkdown(block, options);
    }
  }

  return markdown.trimEnd() + '\n';
}

function LeftBlockToMarkdown(block: LeftContentBlock): string {
  switch (block.type) {
    case 'heading': {
      const prefix = block.level === 2 ? '##' : '###';
      return `${prefix} ${block.text}\n\n`;
    }
    case 'paragraph':
      return `${HtmlToText(block.text)}\n\n`;
    case 'list': {
      let markdown = '';
      for (const item of block.items) {
        markdown += `- ${HtmlToText(item.text)}\n`;
      }
      return markdown + '\n';
    }
    case 'callout':
      return `> **${block.title}** ${HtmlToText(block.text)}\n\n`;
    case 'attributes': {
      let markdown = '';
      for (const attribute of block.attributes) {
        markdown += AttributeToMarkdown(attribute, 0, '');
      }
      if (block.moreAttributes && block.moreAttributes.length > 0) {
        markdown += '### More attributes\n\n';
        for (const attribute of block.moreAttributes) {
          markdown += AttributeToMarkdown(attribute, 0, '');
        }
      }
      return markdown;
    }
  }
}

function RightBlockToMarkdown(
  block: RightContentBlock,
  options: MarkdownOptions
): string {
  switch (block.type) {
    case 'code': {
      const tabs = options.includeAllCodeTabs
        ? block.tabs
        : [
            block.tabs.find((tab) => tab.id === options.preferredCodeTab) ??
              block.tabs[0],
          ].filter((tab) => tab !== undefined);

      let markdown = '';
      for (const tab of tabs) {
        if (options.includeAllCodeTabs && block.tabs.length > 1) {
          markdown += `### ${block.title ? `${block.title} — ` : ''}${
            tab.label
          }\n\n`;
        } else if (block.title) {
          markdown += `### ${block.title}\n\n`;
        }
        const language = tab.id === 'curl' ? 'bash' : 'javascript';
        markdown += `\`\`\`${language}\n${tab.code}\n\`\`\`\n\n`;
      }
      return markdown;
    }
    case 'object':
      return `### ${block.title}\n\n\`\`\`json\n${block.code}\n\`\`\`\n\n`;
    case 'image':
      return `![${block.alt}](${block.src})\n\n`;
  }
}

function AttributeToMarkdown(
  attribute: Attribute,
  depth: number,
  parentPath: string
): string {
  const indent = '  '.repeat(depth);
  const fullName = parentPath
    ? `${parentPath}.${attribute.name}`
    : attribute.name;
  const qualifiers: string[] = [];
  if (attribute.nullable) qualifiers.push('nullable');
  qualifiers.push(attribute.type);
  qualifiers.push(attribute.required ? 'required' : 'optional');

  let markdown = `${indent}- \`${fullName}\` (${qualifiers.join(', ')})\n`;
  markdown += `${indent}  ${HtmlToText(attribute.description)}\n\n`;

  if (attribute.enumNote) {
    markdown += `${indent}  ${HtmlToText(attribute.enumNote)}\n\n`;
  }

  if (attribute.enumValues && attribute.enumValues.length > 0) {
    markdown += `${indent}  Possible enum values:\n`;
    for (const enumValue of attribute.enumValues) {
      const value = typeof enumValue === 'string' ? enumValue : enumValue.value;
      const description =
        typeof enumValue === 'string' ? null : enumValue.description;
      markdown += `${indent}  - \`${value}\`\n`;
      if (description) {
        markdown += `${indent}    ${HtmlToText(description)}\n`;
      }
      markdown += '\n';
    }
  }

  for (const child of attribute.children ?? []) {
    markdown += AttributeToMarkdown(child, depth + 1, fullName);
  }

  return markdown;
}

export function HtmlToText(html: string): string {
  let text = html;
  text = text.replace(/<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)');
  text = text.replace(/<code>([\s\S]*?)<\/code>/g, '`$1`');
  text = text.replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**');
  text = text.replace(/<em>([\s\S]*?)<\/em>/g, '*$1*');
  text = text.replace(/<[^>]+>/g, '');
  return text.trim();
}
