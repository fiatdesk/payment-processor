// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { PAYOUT_BATCH_ABI } from '../../modules/chains/abi/PayoutBatch';
import { USDC_ABI } from '../../modules/chains/abi/Usdc';
import { GetChainConfig } from '../../modules/chains/Chain';
import { Ethereum } from '../../modules/chains/Ethereum';
import { StartAnvil, type AnvilContext } from './Anvil';
import { ReadArtifact } from './Artifacts';

jest.setTimeout(120_000);

describe('Anvil harness', () => {
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
    ).resolves.toBe(BigInt(200));
  });

  it('keeps PAYOUT_BATCH_ABI in sync with the forge artifact', () => {
    expect(PAYOUT_BATCH_ABI).toEqual(ReadArtifact('PayoutBatch').abi);
  });

  it('points the Ethereum rail at the local chain', async () => {
    const { addresses, accounts } = Context();

    expect(GetChainConfig()).toMatchObject({
      chainId: 31337,
      confirmations: 1,
      usdc: addresses.usdc,
      payoutBatch: addresses.payoutBatch,
      subscriptions: null,
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
      before + BigInt(3)
    );
  });
});
