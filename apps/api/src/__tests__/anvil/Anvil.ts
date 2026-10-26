// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Anvil harness for `*.anvil.spec.ts`. StartAnvil() starts a throwaway local
 * chain, deploys MockUSDC and PayoutBatch with account #0, mints USDC to the
 * platform and buyer wallets and points the API's chain env at the chain.
 * Call it in `beforeAll` and `Stop()` in `afterAll`. Importing this module
 * also sets a 120 s timeout for every test and hook in the spec file and adds
 * a file-level `afterAll` that stops any anvil still running.
 */

import { spawn, type ChildProcess } from 'child_process';
import { once } from 'events';
import { createServer, type AddressInfo } from 'net';
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  getAddress,
  http,
  parseAbi,
  parseUnits,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { ResetChainClientsForTests } from '../../modules/chains/Chain';
import { IsSimulatedSettlement } from '../../modules/chains/Settlement';
import { ReadArtifact, type ContractName } from './Artifacts';

export interface AnvilContext {
  rpcUrl: string;
  chainId: 31337;
  /** Private keys of the standard Anvil accounts #0 to #4. */
  accounts: {
    deployer: Hex;
    platform: Hex;
    buyer: Hex;
    relayer: Hex;
    operator: Hex;
  };
  addresses: {
    usdc: Address;
    payoutBatch: Address;
    subscriptions: Address | null;
  };
  publicClient: PublicClient;
  Stop(): Promise<void>;
  Mine(blocks: number): Promise<void>;
}

const ANVIL_CHAIN_ID = 31337;

/** Keys derived from Anvil's public test mnemonic; never use them elsewhere. */
const ANVIL_ACCOUNTS: AnvilContext['accounts'] = {
  deployer:
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  platform:
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  buyer: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  relayer: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6',
  operator:
    '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
};

const INITIAL_USDC_BALANCE = parseUnits('1000000', 6);
const START_ATTEMPTS = 3;
const STARTUP_TIMEOUT_MS = 15_000;
const STOP_TIMEOUT_MS = 5_000;
const POLLING_INTERVAL_MS = 50;

const MINT_ABI = parseAbi(['function mint(address to, uint256 value)']);

jest.setTimeout(120_000);

/** Every anvil this test file started and has not seen exit. */
const running = new Set<ChildProcess>();
let harnessClosed = false;

// Registered on the importing spec file's root block, so it runs after the
// spec's own hooks. It stops an anvil whose context never reached the spec
// (for example when `beforeAll` timed out) and refuses later spawns.
afterAll(async () => {
  harnessClosed = true;
  await Promise.all([...running].map(StopAnvil));
}, STOP_TIMEOUT_MS * 2);

export async function StartAnvil(): Promise<AnvilContext> {
  const { child, rpcUrl } = await SpawnAnvil();
  const Stop = () => StopAnvil(child);
  try {
    const publicClient = createPublicClient({
      chain: foundry,
      transport: http(rpcUrl),
      pollingInterval: POLLING_INTERVAL_MS,
    });
    const deployer = createWalletClient({
      account: privateKeyToAccount(ANVIL_ACCOUNTS.deployer),
      chain: foundry,
      transport: http(rpcUrl),
    });

    const WaitForSuccess = async (hash: Hex) => {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error(`Anvil transaction ${hash} reverted`);
      }
      return receipt;
    };
    const Deploy = async (name: ContractName): Promise<Address> => {
      const { abi, bytecode } = ReadArtifact(name);
      const hash = await deployer.deployContract({ abi, bytecode });
      const { contractAddress } = await WaitForSuccess(hash);
      if (!contractAddress) throw new Error(`Deploying ${name} failed`);
      return getAddress(contractAddress);
    };

    const usdc = await Deploy('MockUSDC');
    const payoutBatch = await Deploy('PayoutBatch');
    for (const key of [ANVIL_ACCOUNTS.platform, ANVIL_ACCOUNTS.buyer]) {
      await WaitForSuccess(
        await deployer.writeContract({
          address: usdc,
          abi: MINT_ABI,
          functionName: 'mint',
          args: [privateKeyToAccount(key).address, INITIAL_USDC_BALANCE],
        })
      );
    }

    Object.assign(process.env, {
      LIVEMODE: 'false',
      SETTLEMENT_RAIL: 'onchain',
      ETH_CHAIN_ID: String(ANVIL_CHAIN_ID),
      ETH_RPC_URL: rpcUrl,
      USDC_ADDRESS: usdc,
      PAYOUT_BATCH_ADDRESS: payoutBatch,
      ETH_CONFIRMATIONS: '1',
      CHECKOUT_RELAYER_KEY: ANVIL_ACCOUNTS.relayer,
      SUBSCRIPTION_OPERATOR_KEY: ANVIL_ACCOUNTS.operator,
    });
    // Nothing else is deployed here, so no shell value may point elsewhere.
    delete process.env.SUBSCRIPTIONS_ADDRESS;
    delete process.env.SANCTIONS_ORACLE_ADDRESS;
    ResetChainClientsForTests();
    if (IsSimulatedSettlement()) {
      throw new Error(
        'StartAnvil: the API still resolves the simulated settlement rail after ResetChainClientsForTests()'
      );
    }

    const testClient = createTestClient({
      mode: 'anvil',
      chain: foundry,
      transport: http(rpcUrl),
    });

    return {
      rpcUrl,
      chainId: ANVIL_CHAIN_ID,
      accounts: { ...ANVIL_ACCOUNTS },
      addresses: { usdc, payoutBatch, subscriptions: null },
      publicClient,
      Stop,
      Mine: (blocks) => testClient.mine({ blocks }),
    };
  } catch (error) {
    await Stop();
    throw error;
  }
}

/** Starts anvil on a free port and waits until its RPC answers. */
async function SpawnAnvil(): Promise<{ child: ChildProcess; rpcUrl: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < START_ATTEMPTS; attempt++) {
    const port = await FreePort();
    const rpcUrl = `http://127.0.0.1:${port}`;
    if (harnessClosed) throw new Error('The Anvil harness has shut down');
    const child = spawn(
      'anvil',
      [
        '--port',
        String(port),
        '--chain-id',
        String(ANVIL_CHAIN_ID),
        '--silent',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );
    running.add(child);
    child.once('exit', () => running.delete(child));
    try {
      await WaitForRpc(child, rpcUrl);
      return { child, rpcUrl };
    } catch (error) {
      lastError = error;
      await StopAnvil(child);
    }
  }
  throw lastError;
}

async function WaitForRpc(child: ChildProcess, rpcUrl: string): Promise<void> {
  const output: { stderr: string; spawnError: Error | null } = {
    stderr: '',
    spawnError: null,
  };
  child.stderr?.on('data', (chunk: Buffer) => {
    output.stderr = (output.stderr + chunk.toString()).slice(-2000);
  });
  child.once('error', (error) => {
    output.spawnError = error;
  });

  const probe = createPublicClient({
    chain: foundry,
    transport: http(rpcUrl, { retryCount: 0 }),
  });
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (output.spawnError) {
      throw new Error(
        `Could not run anvil (${output.spawnError.message}); install Foundry to run the Anvil tests`
      );
    }
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `anvil exited (${child.exitCode ?? child.signalCode}): ${output.stderr}`
      );
    }
    try {
      if ((await probe.getChainId()) === ANVIL_CHAIN_ID) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `anvil did not answer on ${rpcUrl} within ${STARTUP_TIMEOUT_MS} ms`
  );
}

/** Idempotent: resolves once anvil has exited (SIGKILL after a grace period). */
async function StopAnvil(child: ChildProcess): Promise<void> {
  if (child.pid === undefined) return;
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const forceKill = setTimeout(() => child.kill('SIGKILL'), STOP_TIMEOUT_MS);
  try {
    await exited;
  } finally {
    clearTimeout(forceKill);
  }
}

function FreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}
