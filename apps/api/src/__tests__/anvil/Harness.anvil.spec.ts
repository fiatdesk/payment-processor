// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { keccak256, parseUnits, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { GetAppConfig } from '../../modules/AppConfig';
import { PAYOUT_BATCH_ABI } from '../../modules/chains/abi/PayoutBatch';
import { SUBSCRIPTIONS_ABI } from '../../modules/chains/abi/Subscriptions';
import { USDC_ABI } from '../../modules/chains/abi/Usdc';
import { GetChainConfig } from '../../modules/chains/Chain';
import { Ethereum } from '../../modules/chains/Ethereum';
import { GetSettlement } from '../../modules/chains/Settlement';
import { StartAnvil, type AnvilContext } from './Anvil';
import { ReadArtifact } from './Artifacts';

describe('Anvil harness', () => {
  let anvil: AnvilContext | undefined;

  beforeAll(async () => {
    // Memoise the app config on the simulated rail first, as a spec that calls
    // InitializeAppConfig() before StartAnvil() would.
    delete process.env.LIVEMODE;
    delete process.env.SETTLEMENT_RAIL;
    expect(GetAppConfig().settlement_rail).toBe('simulated');

    anvil = await StartAnvil();
  });

  afterAll(async () => {
    await anvil?.Stop();
  });

  function Context(): AnvilContext {
    if (!anvil) throw new Error('Anvil did not start');
    return anvil;
  }

  it('deploys MockUSDC with 6 decimals', async () => {
    const { publicClient, addresses } = Context();

    await expect(
      publicClient.readContract({
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'decimals',
      })
    ).resolves.toBe(6);
  });

  it('mints 1,000,000 USDC to the platform and buyer wallets', async () => {
    const { publicClient, addresses, accounts } = Context();
    const platform = privateKeyToAccount(accounts.platform).address;
    const buyer = privateKeyToAccount(accounts.buyer).address;

    expect(buyer).toBe('0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC');
    for (const owner of [platform, buyer]) {
      await expect(
        publicClient.readContract({
          address: addresses.usdc,
          abi: USDC_ABI,
          functionName: 'balanceOf',
          args: [owner],
        })
      ).resolves.toBe(parseUnits('1000000', 6));
    }
  });

  it('deploys PayoutBatch', async () => {
    const { publicClient, addresses } = Context();

    const code = await publicClient.getCode({ address: addresses.payoutBatch });
    expect(code?.length ?? 0).toBeGreaterThan(2);
    await expect(
      publicClient.readContract({
        address: addresses.payoutBatch,
        abi: PAYOUT_BATCH_ABI,
        functionName: 'MAX_RECIPIENTS',
      })
    ).resolves.toBe(200n);
  });

  it('keeps PAYOUT_BATCH_ABI in sync with the forge artifact', () => {
    expect(PAYOUT_BATCH_ABI).toEqual(ReadArtifact('PayoutBatch').abi);
  });

  it('deploys Subscriptions with its EIP-712 domain and Subscribe type', async () => {
    const { publicClient, addresses, chainId } = Context();

    const code = await publicClient.getCode({
      address: addresses.subscriptions,
    });
    expect(code?.length ?? 0).toBeGreaterThan(2);
    await expect(
      publicClient.readContract({
        address: addresses.subscriptions,
        abi: SUBSCRIPTIONS_ABI,
        functionName: 'MAX_PERIOD_SECONDS',
      })
    ).resolves.toBe(315_360_000n);
    const [, name, version, domainChainId, verifyingContract] =
      await publicClient.readContract({
        address: addresses.subscriptions,
        abi: SUBSCRIPTIONS_ABI,
        functionName: 'eip712Domain',
      });
    expect({ name, version, domainChainId, verifyingContract }).toEqual({
      name: 'Subscriptions',
      version: '1',
      domainChainId: BigInt(chainId),
      verifyingContract: addresses.subscriptions,
    });
    await expect(
      publicClient.readContract({
        address: addresses.subscriptions,
        abi: SUBSCRIPTIONS_ABI,
        functionName: 'SUBSCRIBE_TYPEHASH',
      })
    ).resolves.toBe(
      keccak256(
        toHex(
          'Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint256 nonce,uint256 deadline)'
        )
      )
    );
  });

  it('keeps SUBSCRIPTIONS_ABI in sync with the forge artifact', () => {
    expect(SUBSCRIPTIONS_ABI).toEqual(ReadArtifact('Subscriptions').abi);
  });

  it('points the Ethereum rail at the local chain', async () => {
    const { addresses, accounts } = Context();

    expect(GetAppConfig()).toMatchObject({
      livemode: false,
      settlement_rail: 'onchain',
    });
    expect(GetSettlement()).toBeInstanceOf(Ethereum);
    expect(GetChainConfig()).toMatchObject({
      chainId: 31337,
      confirmations: 1,
      usdc: addresses.usdc,
      payoutBatch: addresses.payoutBatch,
      subscriptions: addresses.subscriptions,
    });
    await expect(
      new Ethereum().GetUSDCBalance(
        privateKeyToAccount(accounts.platform).address
      )
    ).resolves.toBe(1_000_000);
  });

  it('mines blocks on demand', async () => {
    const { publicClient, Mine } = Context();
    const before = await publicClient.getBlockNumber({ cacheTime: 0 });

    await Mine(3);

    await expect(publicClient.getBlockNumber({ cacheTime: 0 })).resolves.toBe(
      before + 3n
    );
  });
});
