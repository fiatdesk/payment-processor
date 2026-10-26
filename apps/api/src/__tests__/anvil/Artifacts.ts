// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Reads compiled contracts from the Foundry output directory
 * (contracts/out/<name>.sol/<name>.json). `npx nx run api:test-anvil` builds
 * them first through its `contracts:build` dependency.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { Abi, Hex } from 'viem';

export type ContractName = 'MockUSDC' | 'PayoutBatch' | 'Subscriptions';

export interface ContractArtifact {
  abi: Abi;
  bytecode: Hex;
}

const FOUNDRY_OUT = resolve(__dirname, '../../../../../contracts/out');

export function ReadArtifact(name: ContractName): ContractArtifact {
  const path = resolve(FOUNDRY_OUT, `${name}.sol`, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path}. Build the contracts with \`npx nx run contracts:build\`.`
    );
  }
  const artifact = JSON.parse(readFileSync(path, 'utf8')) as {
    abi: Abi;
    bytecode: { object: Hex };
  };
  return { abi: artifact.abi, bytecode: artifact.bytecode.object };
}
