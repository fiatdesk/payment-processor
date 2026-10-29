// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Deploys MockUSDC, PayoutBatch and Subscriptions to a fresh local Anvil
 * chain and mints test USDC to the demo platform and buyer accounts.
 *
 * The deployer is Anvil's account #0, so on a fresh chain the contracts land
 * at fixed addresses, which docker-compose.anvil.yml hands to the API. Run
 * again against the same chain, it finds them and changes nothing.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import solc from 'solc';
import {
  createPublicClient,
  createWalletClient,
  formatUnits,
  getAddress,
  http,
  parseUnits,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const RPC_URL = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
const CONTRACTS_DIR = process.env.CONTRACTS_DIR ?? '/contracts';
const OPENZEPPELIN = path.join(
  CONTRACTS_DIR,
  'lib/openzeppelin-contracts/contracts'
);
const MINT_USDC = parseUnits('10000', 6);

/** Anvil's public test accounts (default mnemonic); never use them elsewhere. */
const ACCOUNTS = {
  deployer: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    key: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  platform: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    key: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
  buyer: {
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    key: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a',
  },
};

/** Where account #0's first three deployments land; the API is configured with these. */
const CONTRACTS = [
  {
    name: 'MockUSDC',
    file: 'test/mocks/MockUSDC.sol',
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  },
  {
    name: 'PayoutBatch',
    file: 'src/PayoutBatch.sol',
    address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  },
  {
    name: 'Subscriptions',
    file: 'src/Subscriptions.sol',
    address: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  },
];

const MINT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [],
  },
];

const publicClient = createPublicClient({
  chain: foundry,
  transport: http(RPC_URL),
});
const deployer = createWalletClient({
  account: privateKeyToAccount(ACCOUNTS.deployer.key),
  chain: foundry,
  transport: http(RPC_URL),
});

async function WaitForChain() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      return await publicClient.getChainId();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`No Ethereum node answered at ${RPC_URL}`);
}

async function IsDeployed(address) {
  const code = await publicClient.getCode({ address });
  return !!code && code !== '0x';
}

/** Compiles the three contracts with the settings in contracts/foundry.toml. */
function Compile() {
  if (!existsSync(OPENZEPPELIN)) {
    throw new Error(
      'contracts/lib is empty. Run `git submodule update --init` in the repository, then try again.'
    );
  }
  const sources = Object.fromEntries(
    CONTRACTS.map(({ file }) => [
      file,
      { content: readFileSync(path.join(CONTRACTS_DIR, file), 'utf8') },
    ])
  );
  const input = {
    language: 'Solidity',
    sources,
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const FindImport = (importPath) => {
    const prefix = '@openzeppelin/contracts/';
    if (!importPath.startsWith(prefix)) {
      return { error: `Unknown import ${importPath}` };
    }
    const file = path.join(OPENZEPPELIN, importPath.slice(prefix.length));
    return existsSync(file)
      ? { contents: readFileSync(file, 'utf8') }
      : { error: `Not found: ${importPath}` };
  };
  const output = JSON.parse(
    solc.compile(JSON.stringify(input), { import: FindImport })
  );
  const errors = (output.errors ?? []).filter((e) => e.severity === 'error');
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.formattedMessage).join('\n'));
  }
  return Object.fromEntries(
    CONTRACTS.map(({ name, file }) => {
      const { abi, evm } = output.contracts[file][name];
      return [name, { abi, bytecode: `0x${evm.bytecode.object}` }];
    })
  );
}

async function Deploy() {
  const artifacts = Compile();
  for (const { name, address } of CONTRACTS) {
    const hash = await deployer.deployContract(artifacts[name]);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== 'success' || !receipt.contractAddress) {
      throw new Error(`Deploying ${name} failed`);
    }
    if (getAddress(receipt.contractAddress) !== address) {
      throw new Error(
        `${name} landed at ${receipt.contractAddress}, not ${address}. Start from a fresh chain: docker compose -f docker-compose.yml -f docker-compose.anvil.yml down -v`
      );
    }
    console.log(`Deployed ${name} at ${address}`);
  }
  for (const { address } of [ACCOUNTS.platform, ACCOUNTS.buyer]) {
    const hash = await deployer.writeContract({
      address: CONTRACTS[0].address,
      abi: MINT_ABI,
      functionName: 'mint',
      args: [address, MINT_USDC],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

const chainId = await WaitForChain();
if (chainId !== foundry.id) {
  throw new Error(`Expected a local Anvil chain (${foundry.id}), got ${chainId}`);
}
const deployed = await Promise.all(
  CONTRACTS.map(({ address }) => IsDeployed(address))
);
if (deployed.every(Boolean)) {
  console.log('Contracts are already deployed on this chain.');
} else if (deployed.some(Boolean)) {
  throw new Error(
    'This chain has some contracts but not all. Start from a fresh chain: docker compose -f docker-compose.yml -f docker-compose.anvil.yml down -v'
  );
} else {
  await Deploy();
}

const usdc = (amount) => `${formatUnits(amount, 6)} USDC`;
console.log(`
Local chain ready (chain ID ${foundry.id}, RPC ${RPC_URL.replace('anvil', '127.0.0.1')})

  MockUSDC       ${CONTRACTS[0].address}
  PayoutBatch    ${CONTRACTS[1].address}
  Subscriptions  ${CONTRACTS[2].address}

Test accounts (public Anvil keys, test use only):
  Platform wallet  ${ACCOUNTS.platform.address}  key ${ACCOUNTS.platform.key}  (${usdc(MINT_USDC)} minted)
  Buyer wallet     ${ACCOUNTS.buyer.address}  key ${ACCOUNTS.buyer.key}  (${usdc(MINT_USDC)} minted)

Open http://localhost/setup and use the platform wallet address.
Import the buyer key into MetaMask to pay at checkout.
`);
