import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const files = ['index.d.ts', 'index.js', 'index.mjs'];
const forbidden = [
  "from '@zoneless/shared-types'",
  'from "@zoneless/shared-types"',
  "from '@zoneless/shared-schemas'",
  'from "@zoneless/shared-schemas"',
  "from 'zod'",
  'from "zod"',
  'libphonenumber-js',
];

for (const file of files) {
  const contents = readFileSync(join(distDir, file), 'utf8');
  for (const token of forbidden) {
    if (contents.includes(token)) {
      console.error(
        `Published SDK file ${file} still references ${token}. The public package must not leak workspace libs, Zod, or libphonenumber-js.`
      );
      process.exit(1);
    }
  }
}
