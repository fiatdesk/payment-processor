// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Pins MockUSDC to the FiatTokenV2 behaviour the API relies on, using the same
 * viem signing calls the API and wallets make: the EIP-712 domain, EIP-2612
 * permit, EIP-3009 transfer/receive with authorization and the blacklist.
 */
import { randomBytes } from 'crypto';
import {
  createWalletClient,
  domainSeparator,
  http,
  parseAbi,
  parseEventLogs,
  parseSignature,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { USDC_ABI } from '../../modules/chains/abi/Usdc';
import { StartAnvil, type AnvilContext } from './Anvil';

/** MockUSDC functions that USDC_ABI does not cover. */
const MOCK_USDC_ABI = parseAbi([
  'function symbol() view returns (string)',
  'function version() view returns (string)',
  'function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)',
  'function blacklist(address account, bool blacklisted)',
]);

const AUTHORIZATION_FIELDS = [
  { name: 'from', type: 'address' },
  { name: 'to', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'validAfter', type: 'uint256' },
  { name: 'validBefore', type: 'uint256' },
  { name: 'nonce', type: 'bytes32' },
] as const;

const AUTHORIZATION_TYPES = {
  TransferWithAuthorization: AUTHORIZATION_FIELDS,
  ReceiveWithAuthorization: AUTHORIZATION_FIELDS,
} as const;

const PERMIT_TYPES = {
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

const FIVE_USDC = 5_000_000n;

describe('MockUSDC (FiatTokenV2 fidelity)', () => {
  let anvil: AnvilContext | undefined;

  beforeAll(async () => {
    anvil = await StartAnvil();
  });

  afterAll(async () => {
    await anvil?.Stop();
  });

  function Context(): AnvilContext {
    if (!anvil) throw new Error('Anvil did not start');
    return anvil;
  }

  function Wallet(privateKey: Hex) {
    return createWalletClient({
      account: privateKeyToAccount(privateKey),
      chain: foundry,
      transport: http(Context().rpcUrl),
    });
  }

  /** The domain wallets sign: name read from the token, version "2". */
  async function Domain() {
    const { publicClient, addresses } = Context();
    const name = await publicClient.readContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'name',
    });
    return {
      name,
      version: '2',
      chainId: 31337,
      verifyingContract: addresses.usdc,
    } as const;
  }

  async function BalanceOf(owner: Address): Promise<bigint> {
    const { publicClient, addresses } = Context();
    return publicClient.readContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [owner],
    });
  }

  async function ChainTime(): Promise<bigint> {
    return (await Context().publicClient.getBlock()).timestamp;
  }

  type Authorization = Awaited<ReturnType<typeof SignAuthorization>>;

  /** Signs an EIP-3009 authorization from the buyer and returns call args. */
  async function SignAuthorization(
    primaryType: keyof typeof AUTHORIZATION_TYPES,
    to: Address,
    window?: { validAfter: bigint; validBefore: bigint }
  ) {
    const buyer = privateKeyToAccount(Context().accounts.buyer);
    const now = await ChainTime();
    const message = {
      from: buyer.address,
      to,
      value: FIVE_USDC,
      validAfter: window?.validAfter ?? 0n,
      validBefore: window?.validBefore ?? now + 3600n,
      nonce: toHex(randomBytes(32)),
    };
    const { v, r, s } = parseSignature(
      await buyer.signTypedData({
        domain: await Domain(),
        types: AUTHORIZATION_TYPES,
        primaryType,
        message,
      })
    );
    return {
      nonce: message.nonce,
      args: [
        message.from,
        message.to,
        message.value,
        message.validAfter,
        message.validBefore,
        message.nonce,
        Number(v),
        r,
        s,
      ] as const,
    };
  }

  it('matches the FiatTokenV2 metadata and EIP-712 domain', async () => {
    const { publicClient, addresses } = Context();
    const read = <T extends 'symbol' | 'version'>(functionName: T) =>
      publicClient.readContract({
        address: addresses.usdc,
        abi: MOCK_USDC_ABI,
        functionName,
      });

    const domain = await Domain();
    expect(domain.name).toBe('USD Coin');
    await expect(read('symbol')).resolves.toBe('USDC');
    await expect(read('version')).resolves.toBe('2');
    await expect(
      publicClient.readContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'DOMAIN_SEPARATOR',
      })
    ).resolves.toBe(domainSeparator({ domain }));
  });

  it('transferWithAuthorization settles a viem signature once and emits AuthorizationUsed', async () => {
    const { publicClient, addresses, accounts } = Context();
    const buyer = privateKeyToAccount(accounts.buyer).address;
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const relayer = Wallet(accounts.relayer);
    const buyerBefore = await BalanceOf(buyer);
    const { nonce, args } = await SignAuthorization(
      'TransferWithAuthorization',
      merchant
    );

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: await relayer.writeContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'transferWithAuthorization',
        args,
      }),
    });

    expect(receipt.status).toBe('success');
    expect(await BalanceOf(merchant)).toBe(FIVE_USDC);
    expect(await BalanceOf(buyer)).toBe(buyerBefore - FIVE_USDC);
    expect(
      parseEventLogs({
        abi: USDC_ABI,
        eventName: 'AuthorizationUsed',
        logs: receipt.logs,
      }).map((log) => log.args)
    ).toEqual([{ authorizer: buyer, nonce }]);
    await expect(
      publicClient.readContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'authorizationState',
        args: [buyer, nonce],
      })
    ).resolves.toBe(true);
    await expect(
      publicClient.simulateContract({
        account: relayer.account,
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'transferWithAuthorization',
        args,
      })
    ).rejects.toThrow('FiatTokenV2: authorization is used or canceled');
  });

  it('transferWithAuthorization enforces validAfter and validBefore', async () => {
    const { publicClient, addresses, accounts } = Context();
    const merchant = privateKeyToAccount(generatePrivateKey()).address;
    const now = await ChainTime();
    const Simulate = ({ args }: Authorization) =>
      publicClient.simulateContract({
        account: Wallet(accounts.relayer).account,
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'transferWithAuthorization',
        args,
      });

    const early = await SignAuthorization(
      'TransferWithAuthorization',
      merchant,
      { validAfter: now + 3600n, validBefore: now + 7200n }
    );
    const expired = await SignAuthorization(
      'TransferWithAuthorization',
      merchant,
      { validAfter: 0n, validBefore: now - 1n }
    );

    await expect(Simulate(early)).rejects.toThrow(
      'FiatTokenV2: authorization is not yet valid'
    );
    await expect(Simulate(expired)).rejects.toThrow(
      'FiatTokenV2: authorization is expired'
    );
  });

  it('receiveWithAuthorization accepts only the payee as caller', async () => {
    const { publicClient, addresses, accounts } = Context();
    const platform = privateKeyToAccount(accounts.platform).address;
    const platformBefore = await BalanceOf(platform);
    const { args } = await SignAuthorization(
      'ReceiveWithAuthorization',
      platform
    );

    await expect(
      publicClient.simulateContract({
        account: Wallet(accounts.relayer).account,
        address: addresses.usdc,
        abi: MOCK_USDC_ABI,
        functionName: 'receiveWithAuthorization',
        args,
      })
    ).rejects.toThrow('FiatTokenV2: caller must be the payee');

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: await Wallet(accounts.platform).writeContract({
        address: addresses.usdc,
        abi: MOCK_USDC_ABI,
        functionName: 'receiveWithAuthorization',
        args,
      }),
    });
    expect(receipt.status).toBe('success');
    expect(await BalanceOf(platform)).toBe(platformBefore + FIVE_USDC);
  });

  it('rejects a signature made for the other authorization type', async () => {
    const { publicClient, addresses, accounts } = Context();
    const platform = privateKeyToAccount(accounts.platform).address;
    const { args } = await SignAuthorization(
      'TransferWithAuthorization',
      platform
    );

    await expect(
      publicClient.simulateContract({
        account: Wallet(accounts.platform).account,
        address: addresses.usdc,
        abi: MOCK_USDC_ABI,
        functionName: 'receiveWithAuthorization',
        args,
      })
    ).rejects.toThrow('FiatTokenV2: invalid signature');
  });

  it('permit sets the allowance from a viem EIP-2612 signature and uses the nonce', async () => {
    const { publicClient, addresses, accounts } = Context();
    const owner = privateKeyToAccount(accounts.buyer);
    const spender = addresses.payoutBatch;
    const deadline = (await ChainTime()) + 3600n;
    const nonce = await publicClient.readContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'nonces',
      args: [owner.address],
    });
    const { v, r, s } = parseSignature(
      await owner.signTypedData({
        domain: await Domain(),
        types: PERMIT_TYPES,
        primaryType: 'Permit',
        message: {
          owner: owner.address,
          spender,
          value: FIVE_USDC,
          nonce,
          deadline,
        },
      })
    );
    const args = [
      owner.address,
      spender,
      FIVE_USDC,
      deadline,
      Number(v),
      r,
      s,
    ] as const;
    const relayer = Wallet(accounts.relayer);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: await relayer.writeContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'permit',
        args,
      }),
    });

    expect(receipt.status).toBe('success');
    await expect(
      publicClient.readContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'allowance',
        args: [owner.address, spender],
      })
    ).resolves.toBe(FIVE_USDC);
    await expect(
      publicClient.readContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'nonces',
        args: [owner.address],
      })
    ).resolves.toBe(nonce + 1n);
    await expect(
      publicClient.simulateContract({
        account: relayer.account,
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'permit',
        args,
      })
    ).rejects.toThrow('EIP2612: invalid signature');
  });

  it('blocks blacklisted accounts with the FiatTokenV2 revert string', async () => {
    const { publicClient, addresses, accounts } = Context();
    const frozen = privateKeyToAccount(generatePrivateKey()).address;
    const buyer = privateKeyToAccount(accounts.buyer);
    await publicClient.waitForTransactionReceipt({
      hash: await Wallet(accounts.deployer).writeContract({
        address: addresses.usdc,
        abi: MOCK_USDC_ABI,
        functionName: 'blacklist',
        args: [frozen, true],
      }),
    });
    const { args } = await SignAuthorization(
      'TransferWithAuthorization',
      frozen
    );

    await expect(
      publicClient.readContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'isBlacklisted',
        args: [frozen],
      })
    ).resolves.toBe(true);
    await expect(
      publicClient.simulateContract({
        account: buyer,
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [frozen, 1n],
      })
    ).rejects.toThrow('Blacklistable: account is blacklisted');
    await expect(
      publicClient.simulateContract({
        account: Wallet(accounts.relayer).account,
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'transferWithAuthorization',
        args,
      })
    ).rejects.toThrow('Blacklistable: account is blacklisted');
  });
});
