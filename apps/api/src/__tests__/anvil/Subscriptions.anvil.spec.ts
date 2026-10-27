// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Subscriptions on a real chain: the operator (account #4) creates a plan,
 * the buyer signs the API's permit and Subscribe typed data with viem, the
 * relayer (account #3) submits them, and the operator charges each period.
 */
import {
  createTestClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type { Eip712TypedData } from '@zoneless/shared-types';
import { SUBSCRIPTIONS_ABI } from '../../modules/chains/abi/Subscriptions';
import { USDC_ABI } from '../../modules/chains/abi/Usdc';
import { Ethereum } from '../../modules/chains/Ethereum';
import {
  PermitValue,
  SubscriptionIdFor,
} from '../../modules/chains/SubscriptionAuthorization';
import type { PreparedSubscribe } from '../../modules/chains/types';
import { StartAnvil, type AnvilContext } from './Anvil';

const TIMEOUT = { timeoutMs: 10_000 };
const PERIOD_SECONDS = 30 * 24 * 3600;
/** 20 USDC a period. */
const AMOUNT_CENTS = 2000;
const AMOUNT = 20_000_000n;

describe('Subscriptions on Anvil', () => {
  let anvil: AnvilContext | undefined;
  let ethereum: Ethereum;
  let buyer: Address;
  let platform: Address;
  let operator: Address;
  let relayer: Address;
  let prices = 0;

  beforeAll(async () => {
    anvil = await StartAnvil();
    buyer = privateKeyToAccount(anvil.accounts.buyer).address;
    platform = privateKeyToAccount(anvil.accounts.platform).address;
    operator = privateKeyToAccount(anvil.accounts.operator).address;
    relayer = privateKeyToAccount(anvil.accounts.relayer).address;
    ethereum = new Ethereum();
  });

  afterAll(async () => {
    await anvil?.Stop();
  });

  function Context(): AnvilContext {
    if (!anvil) throw new Error('Anvil did not start');
    return anvil;
  }

  async function ChainTime(): Promise<number> {
    return Number((await Context().publicClient.getBlock()).timestamp);
  }

  async function PassTime(seconds: number): Promise<void> {
    await createTestClient({
      mode: 'anvil',
      chain: foundry,
      transport: http(Context().rpcUrl),
    }).increaseTime({ seconds });
    await Context().Mine(1);
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

  async function Allowance(): Promise<bigint> {
    const { publicClient, addresses } = Context();
    return publicClient.readContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'allowance',
      args: [buyer, addresses.subscriptions],
    });
  }

  function SentFrom(address: Address): Promise<number> {
    return Context().publicClient.getTransactionCount({
      address,
      blockTag: 'pending',
    });
  }

  function BuyerWallet() {
    return createWalletClient({
      account: privateKeyToAccount(Context().accounts.buyer),
      chain: foundry,
      transport: http(Context().rpcUrl),
    });
  }

  /** The buyer calls the Subscriptions contract directly. */
  async function BuyerCalls(
    functionName: 'pause' | 'resume',
    subId: Hex
  ): Promise<void> {
    const { publicClient, addresses } = Context();
    const hash = await BuyerWallet().writeContract({
      address: addresses.subscriptions,
      abi: SUBSCRIPTIONS_ABI,
      functionName,
      args: [subId],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  /** The buyer signs typed data exactly as the API returned it. */
  async function Sign(typedData: Eip712TypedData | null): Promise<Hex> {
    if (!typedData) throw new Error('No typed data to sign');
    return privateKeyToAccount(Context().accounts.buyer).signTypedData(
      typedData as unknown as TypedDataDefinition
    );
  }

  /** A plan for a fresh price, created from the operator key. */
  async function Plan(amountCents = AMOUNT_CENTS): Promise<Hex> {
    return (await ethereum.CreateSubscriptionPlan(
      `price_z_anvil_${++prices}`,
      PERIOD_SECONDS,
      amountCents,
      platform,
      operator
    )) as Hex;
  }

  /** What the buyer signs for `planKey`, and the signatures. */
  async function Signed(planKey: Hex) {
    const prepared: PreparedSubscribe =
      await ethereum.BuildSubscribeAuthorization(
        buyer,
        planKey,
        (await ChainTime()) + 3600
      );
    return {
      prepared,
      relay: {
        planKey,
        subscriber: buyer,
        permitSignature: prepared.needs_permit
          ? await Sign(prepared.permit_typed_data)
          : null,
        subscribeSignature: await Sign(prepared.subscribe_typed_data),
        deadline: prepared.deadline ?? 0,
      },
    };
  }

  async function Relay(relay: Awaited<ReturnType<typeof Signed>>['relay']) {
    const signed: string[] = [];
    const hash = await ethereum.RelaySubscribe(relay, {
      onSigned: async (transactionHash) => {
        signed.push(transactionHash);
      },
    });
    return { hash, signed };
  }

  /** Signs, relays and verifies a subscribe; returns the subscription id. */
  async function Subscribe(planKey: Hex): Promise<Hex> {
    const { relay } = await Signed(planKey);
    const { hash } = await Relay(relay);
    await Context().Mine(1);
    const verification = await ethereum.VerifySubscribeTransaction(
      hash,
      { planKey, subscriberWallet: buyer },
      TIMEOUT
    );
    expect(verification.status).toBe('verified');
    return verification.subscription_onchain_id as Hex;
  }

  function Collect(planKey: Hex, subId: Hex) {
    return ethereum.CollectSubscriptionPayment({
      subscriptionOnchainId: subId,
      planKey,
      subscriberWallet: buyer,
      amountCents: AMOUNT_CENTS,
    });
  }

  it('creates a plan, relays a permit and subscribe, and charges once per period', async () => {
    const { publicClient, addresses } = Context();
    const planKey = await Plan();

    await expect(
      publicClient.readContract({
        address: addresses.subscriptions,
        abi: SUBSCRIPTIONS_ABI,
        functionName: 'plans',
        args: [planKey],
      })
    ).resolves.toEqual([
      operator,
      operator,
      platform,
      addresses.usdc,
      AMOUNT,
      BigInt(PERIOD_SECONDS),
      true,
    ]);
    // A retry for the same price finds the plan and sends nothing.
    const operatorNonce = await SentFrom(operator);
    await expect(
      ethereum.CreateSubscriptionPlan(
        `price_z_anvil_${prices}`,
        PERIOD_SECONDS,
        AMOUNT_CENTS,
        platform,
        operator
      )
    ).resolves.toBe(planKey);
    expect(await SentFrom(operator)).toBe(operatorNonce);

    // A first-time subscriber signs the bounded permit and the Subscribe.
    const now = await ChainTime();
    const { prepared, relay } = await Signed(planKey);
    const permitValue = PermitValue({
      amount: AMOUNT,
      periodSeconds: BigInt(PERIOD_SECONDS),
    });
    expect(permitValue).toBe(AMOUNT * 13n);
    expect(prepared).toMatchObject({
      needs_permit: true,
      fee_currency: 'eth',
      chain_id: 31337,
      permit_typed_data: {
        domain: {
          name: 'USD Coin',
          version: '2',
          chainId: 31337,
          verifyingContract: addresses.usdc,
        },
        message: {
          owner: buyer,
          spender: addresses.subscriptions,
          value: permitValue.toString(),
        },
      },
      subscribe_typed_data: {
        domain: {
          name: 'Subscriptions',
          version: '1',
          chainId: 31337,
          verifyingContract: addresses.subscriptions,
        },
        message: {
          planKey,
          subscriber: buyer,
          token: addresses.usdc,
          amount: AMOUNT.toString(),
          periodSeconds: String(PERIOD_SECONDS),
          nonce: '0',
        },
      },
    });
    expect(prepared.deadline).toBeGreaterThanOrEqual(now + 1800);
    expect(prepared.deadline).toBeLessThanOrEqual(now + 1801);

    const { hash, signed } = await Relay(relay);
    if (!hash) throw new Error('Nothing was relayed');
    expect(signed).toEqual([hash]);
    const transaction = await publicClient.getTransaction({
      hash: hash as Hex,
    });
    expect(transaction.from).toBe(relayer.toLowerCase());

    await Context().Mine(1);
    const subId = SubscriptionIdFor(planKey, buyer);
    await expect(
      ethereum.VerifySubscribeTransaction(
        hash,
        { planKey, subscriberWallet: buyer },
        TIMEOUT
      )
    ).resolves.toEqual({
      status: 'verified',
      transaction_hash: hash,
      subscriber_address: buyer,
      subscription_onchain_id: subId,
    });
    await expect(
      ethereum.FindExistingSubscription(planKey, buyer)
    ).resolves.toBe(subId);
    expect(await Allowance()).toBe(permitValue);
    // Relaying the same signatures again sends nothing.
    await expect(Relay(relay)).resolves.toEqual({ hash: null, signed: [] });

    // The first period is due at once and moves the amount to the plan's
    // destination, from the operator key.
    const [platformBefore, buyerBefore] = await Promise.all([
      BalanceOf(platform),
      BalanceOf(buyer),
    ]);
    const first = await Collect(planKey, subId);
    expect(first.alreadyCollected).toBe(false);
    expect(
      (
        await publicClient.getTransaction({
          hash: first.transaction_hash as Hex,
        })
      ).from
    ).toBe(operator.toLowerCase());
    expect(await BalanceOf(platform)).toBe(platformBefore + AMOUNT);
    expect(await BalanceOf(buyer)).toBe(buyerBefore - AMOUNT);

    // The same period cannot be collected twice; nothing is sent.
    const nonceAfterCharge = await SentFrom(operator);
    await expect(Collect(planKey, subId)).resolves.toEqual({
      transaction_hash: null,
      alreadyCollected: true,
    });
    expect(await SentFrom(operator)).toBe(nonceAfterCharge);
    expect(await BalanceOf(platform)).toBe(platformBefore + AMOUNT);

    // The next period collects again.
    await PassTime(PERIOD_SECONDS + 1);
    await expect(Collect(planKey, subId)).resolves.toMatchObject({
      alreadyCollected: false,
    });
    expect(await BalanceOf(platform)).toBe(platformBefore + 2n * AMOUNT);
    expect(await Allowance()).toBe(permitValue - 2n * AMOUNT);
  });

  it('subscribes with the Subscribe signature alone when the allowance covers the permit value', async () => {
    // The first test left 11 periods of 20 USDC; 1 USDC a period needs 13.
    const planKey = await Plan(100);
    const { prepared, relay } = await Signed(planKey);

    expect(prepared).toMatchObject({
      needs_permit: false,
      permit_typed_data: null,
    });
    expect(relay.permitSignature).toBeNull();
    const { hash } = await Relay(relay);
    await Context().Mine(1);

    await expect(
      ethereum.VerifySubscribeTransaction(
        hash,
        { planKey, subscriberWallet: buyer },
        TIMEOUT
      )
    ).resolves.toMatchObject({
      status: 'verified',
      subscription_onchain_id: SubscriptionIdFor(planKey, buyer),
    });
  });

  it('reports an on-chain pause before charging, and charges after the subscriber resumes', async () => {
    const planKey = await Plan();
    const subId = await Subscribe(planKey);
    await BuyerCalls('pause', subId);

    await expect(ethereum.GetSubscriptionStatus(subId)).resolves.toBe('paused');
    await expect(Collect(planKey, subId)).rejects.toMatchObject({
      statusCode: 409,
      type: 'paused_on_chain',
    });

    await BuyerCalls('resume', subId);
    await expect(ethereum.GetSubscriptionStatus(subId)).resolves.toBe('active');
    // Resuming does not move the schedule: the first period is still due.
    await expect(Collect(planKey, subId)).resolves.toMatchObject({
      alreadyCollected: false,
    });
  });

  it('answers a signature made stale by a cancel with a 409, and cancels from the plan owner', async () => {
    const planKey = await Plan();
    const subId = await Subscribe(planKey);
    // Signed for another plan before the cancel used the subscriber's nonce.
    const { relay } = await Signed(await Plan());

    await expect(ethereum.CancelSubscription(subId)).resolves.toMatch(
      /^0x[0-9a-f]{64}$/
    );
    await expect(ethereum.GetSubscriptionStatus(subId)).resolves.toBe(
      'canceled'
    );
    await expect(ethereum.CancelSubscription(subId)).resolves.toBeNull();
    await expect(Collect(planKey, subId)).rejects.toMatchObject({
      statusCode: 400,
      message: 'The subscriber canceled this subscription on-chain',
    });

    const relayerNonce = await SentFrom(relayer);
    await expect(Relay(relay)).rejects.toMatchObject({
      statusCode: 409,
      type: 'subscription_authorization_stale',
    });
    expect(await SentFrom(relayer)).toBe(relayerNonce);
  });

  it('reports an exhausted allowance as collection_failed_allowance', async () => {
    const { publicClient, addresses } = Context();
    const planKey = await Plan();
    const subId = await Subscribe(planKey);
    const hash = await BuyerWallet().writeContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [addresses.subscriptions, AMOUNT - 1n],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    await expect(Collect(planKey, subId)).rejects.toMatchObject({
      statusCode: 402,
      type: 'collection_failed_allowance',
    });
  });
});
