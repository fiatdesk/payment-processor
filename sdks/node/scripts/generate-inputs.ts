import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const resourcesDir = join(root, 'sdks/node/src/resources');
const outputPath = join(root, 'sdks/node/src/generated/Inputs.ts');
const virtualPath = join(root, 'sdks/node/scripts/__inputs-probe.ts');

function CollectInputNames(): string[] {
  const names = new Set<string>();
  const importPattern =
    /import type \{([^}]+)\} from '(?:@zoneless\/shared-schemas|\.\.\/generated\/Inputs)'/gs;
  for (const file of readdirSync(resourcesDir)) {
    if (!file.endsWith('.ts') || file.endsWith('.spec.ts')) {
      continue;
    }
    const text = readFileSync(join(resourcesDir, file), 'utf8');
    for (const match of text.matchAll(importPattern)) {
      for (const part of match[1].split(',')) {
        const name = part.trim();
        if (name) {
          names.add(name);
        }
      }
    }
  }
  return [...names].sort();
}

function PrintResolved(
  checker: ts.TypeChecker,
  type: ts.Type,
  node?: ts.Node
): string {
  const flags =
    ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseStructuralFallback;
  const text = checker.typeToString(type, node, flags);
  if (/^S\.[A-Za-z0-9_$]+$/.test(text.trim())) {
    return PrintAsObject(checker, type);
  }
  return text.replace(/import\((?:'[^']+'|"[^"]+")\)\.([A-Za-z0-9_$]+)/g, '$1');
}

function PrintAsObject(checker: ts.TypeChecker, type: ts.Type): string {
  const apparent = checker.getApparentType(type);
  const props = apparent.getProperties();
  if (props.length === 0) {
    return checker.typeToString(
      apparent,
      undefined,
      ts.TypeFormatFlags.NoTruncation
    );
  }
  const fields = props.map((symbol) => {
    const decl = symbol.valueDeclaration ?? symbol.declarations?.[0];
    const optional = Boolean(symbol.flags & ts.SymbolFlags.Optional);
    const propType = decl
      ? checker.getTypeOfSymbolAtLocation(symbol, decl)
      : checker.getTypeOfSymbol(symbol);
    return `  ${symbol.getName()}${optional ? '?' : ''}: ${PrintResolved(
      checker,
      propType,
      decl
    )};`;
  });
  return `{\n${fields.join('\n')}\n}`;
}

function PrintType(
  checker: ts.TypeChecker,
  node: ts.TypeAliasDeclaration
): string {
  const type = checker.getTypeFromTypeNode(node.type);
  return PrintResolved(checker, type, node);
}

const inputNames = CollectInputNames();
if (inputNames.length === 0) {
  throw new Error('No shared-schema input types found in SDK resources');
}

const virtualContent = [
  "import type * as S from '@zoneless/shared-schemas';",
  ...inputNames.map((name) => `type ${name} = S.${name};`),
  '',
].join('\n');

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  skipLibCheck: true,
  esModuleInterop: true,
  baseUrl: root,
  paths: {
    '@zoneless/shared-schemas': ['libs/shared-schemas/src/index.ts'],
    '@zoneless/shared-types': ['libs/shared-types/src/index.ts'],
  },
};

const host = ts.createCompilerHost(compilerOptions);
const readFile = host.readFile.bind(host);
const fileExists = host.fileExists.bind(host);
host.fileExists = (fileName) =>
  fileName === virtualPath || fileExists(fileName);
host.readFile = (fileName) =>
  fileName === virtualPath ? virtualContent : readFile(fileName);

const program = ts.createProgram([virtualPath], compilerOptions, host);
const diagnostics = ts.getPreEmitDiagnostics(program);
const errors = diagnostics.filter(
  (d) => d.category === ts.DiagnosticCategory.Error
);
if (errors.length > 0) {
  const message = errors
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    .join('\n');
  throw new Error(`Failed to expand SDK input types:\n${message}`);
}

const checker = program.getTypeChecker();
const source = program.getSourceFile(virtualPath);
if (!source) {
  throw new Error('Missing virtual input probe');
}

const aliases = new Map<string, string>();
for (const stmt of source.statements) {
  if (ts.isTypeAliasDeclaration(stmt) && inputNames.includes(stmt.name.text)) {
    aliases.set(stmt.name.text, PrintType(checker, stmt));
  }
}

const missing = inputNames.filter((name) => !aliases.has(name));
if (missing.length > 0) {
  throw new Error(`Could not expand input types: ${missing.join(', ')}`);
}

const body = inputNames
  .map((name) => `export type ${name} = ${aliases.get(name)};`)
  .join('\n\n');

const banner = `/**
 * Generated from the API request schemas. Do not edit.
 *
 * These are plain object types so the published SDK does not import Zod.
 */

export interface MarketingFeature {
  name: string | null;
}
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${banner}\n${body}\n`);

if (
  body.includes('zod') ||
  /\bS\./.test(body) ||
  body.includes('import(') ||
  /from ['"]zod['"]/.test(body)
) {
  throw new Error(
    'Expanded SDK input types still reference Zod or workspace packages'
  );
}

console.log(`Wrote ${inputNames.length} SDK input types to ${outputPath}`);
