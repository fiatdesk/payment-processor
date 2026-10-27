// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Hosted checkout on a real chain: the buyer signs the API's EIP-3009 typed
 * data with viem, the relayer (account #3) submits it, and verification reads
 * the receipt and the `AuthorizationUsed` log at the confirmed block.
 */
import {
  createWalletClient,
  http,
  parseSignature,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import type {
  BalanceTransaction,
  CheckoutSession,
  CheckoutTransferAuthorization,
  Eip712TypedData,
  PaymentIntent,
} from '@zoneless/shared-types';
import { CheckoutPaymentModule } from '../../modules/CheckoutPayment';
import { CheckoutSessionModule } from '../../modules/CheckoutSession';
import { ChargeModule } from '../../modules/Charge';
import type { EventService } from '../../modules/EventService';
import type { ExternalWalletModule } from '../../modules/ExternalWallet';
import { PaymentIntentModule } from '../../modules/PaymentIntent';
import { ProductModule } from '../../modules/Product';
import { USDC_ABI } from '../../modules/chains/abi/Usdc';
import { Ethereum } from '../../modules/chains/Ethereum';
import type {
  CheckoutPaymentExpectation,
  PreparedAuthorization,
} from '../../modules/chains/types';
import { MemoryDatabase } from '../mocks/MemoryDatabase';
import { StartAnvil, type AnvilContext } from './Anvil';

const TIMEOUT = { timeoutMs: 10_000 };

describe('Checkout on Anvil', () => {
  let anvil: AnvilContext | undefined;
  let ethereum: Ethereum;
  let buyer: Address;
  let merchant: Address;
  let relayer: Address;
  let sessions = 0;

  beforeAll(async () => {
    anvil = await StartAnvil();
    buyer = privateKeyToAccount(anvil.accounts.buyer).address;
    merchant = privateKeyToAccount(anvil.accounts.platform).address;
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

  async function BalanceOf(owner: Address): Promise<bigint> {
    const { publicClient, addresses } = Context();
    return publicClient.readContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'balanceOf',
      args: [owner],
    });
  }

  async function RelayerNonce(): Promise<number> {
    return Context().publicClient.getTransactionCount({
      address: relayer,
      blockTag: 'pending',
    });
  }

  /** The buyer signs the typed data exactly as the API returned it. */
  async function Sign(typedData: Eip712TypedData | null): Promise<Hex> {
    if (!typedData) throw new Error('No typed data to sign');
    return privateKeyToAccount(Context().accounts.buyer).signTypedData(
      typedData as unknown as TypedDataDefinition
    );
  }

  /** A fresh session paying `to`, prepared and signed by the buyer. */
  async function SignedPayment(amountCents: number, to: Address = merchant) {
    const createdAt = await ChainTime();
    const sessionId = `cs_z_anvil_${++sessions}`;
    const prepared: PreparedAuthorization =
      await ethereum.BuildCheckoutPaymentAuthorization(
        buyer,
        to,
        amountCents,
        sessionId,
        createdAt + 3600
      );
    if (!prepared.authorization) throw new Error('No authorization');
    const expected: CheckoutPaymentExpectation = {
      merchantWalletAddress: merchant,
      amountInCents: amountCents,
      checkoutSessionId: sessionId,
      payerAddress: buyer,
      createdAt,
    };
    return {
      prepared,
      authorization: prepared.authorization,
      signature: await Sign(prepared.typed_data),
      expected,
    };
  }

  async function Relay(
    authorization: CheckoutTransferAuthorization,
    signature: Hex
  ): Promise<{ hash: string | null; signed: string[] }> {
    const signed: string[] = [];
    const hash = await ethereum.RelayCheckoutAuthorization(
      authorization,
      signature,
      {
        onSigned: async (transactionHash) => {
          signed.push(transactionHash);
        },
      }
    );
    return { hash, signed };
  }

  /** transferWithAuthorization arguments, for direct submissions. */
  function CallArgs(
    authorization: CheckoutTransferAuthorization,
    signature: Hex
  ) {
    const { v, r, s, yParity } = parseSignature(signature);
    return [
      authorization.from as Address,
      authorization.to as Address,
      BigInt(authorization.value),
      BigInt(authorization.valid_after),
      BigInt(authorization.valid_before),
      authorization.nonce as Hex,
      Number(v ?? BigInt(27 + yParity)),
      r,
      s,
    ] as const;
  }

  function Wallet(privateKey: Hex) {
    return createWalletClient({
      account: privateKeyToAccount(privateKey),
      chain: foundry,
      transport: http(Context().rpcUrl),
    });
  }

  it('relays a buyer-signed authorization and verifies the buyer paid the merchant', async () => {
    const { prepared, authorization, signature, expected } =
      await SignedPayment(1234);
    expect(prepared).toMatchObject({
      method: 'eip3009_transfer',
      fee_currency: 'eth',
      chain_id: 31337,
    });
    expect(prepared.typed_data?.domain).toEqual({
      name: 'USD Coin',
      version: '2',
      chainId: 31337,
      verifyingContract: Context().addresses.usdc,
    });
    const [merchantBefore, buyerBefore] = await Promise.all([
      BalanceOf(merchant),
      BalanceOf(buyer),
    ]);

    const { hash, signed } = await Relay(authorization, signature);
    if (!hash) throw new Error('Nothing was relayed');

    expect(signed).toEqual([hash]);
    const transaction = await Context().publicClient.getTransaction({
      hash: hash as Hex,
    });
    expect(transaction.from).toBe(relayer.toLowerCase());
    await Context().Mine(1);
    await expect(
      ethereum.VerifyCheckoutPayment(hash, expected, TIMEOUT)
    ).resolves.toEqual({
      status: 'verified',
      transaction_hash: hash,
      amount_cents: 1234,
      payer_address: buyer,
    });
    expect(await BalanceOf(merchant)).toBe(merchantBefore + 12_340_000n);
    expect(await BalanceOf(buyer)).toBe(buyerBefore - 12_340_000n);
  });

  it('does not relay a used authorization again; a second relay reverts on the used nonce', async () => {
    const { publicClient, accounts, addresses } = Context();
    const { authorization, signature, expected } = await SignedPayment(500);
    const { hash: first } = await Relay(authorization, signature);
    if (!first) throw new Error('Nothing was relayed');
    await Context().Mine(1);
    const nonceBefore = await RelayerNonce();

    await expect(Relay(authorization, signature)).resolves.toEqual({
      hash: null,
      signed: [],
    });
    expect(await RelayerNonce()).toBe(nonceBefore);

    // Submitted anyway, the same authorization reverts.
    const args = CallArgs(authorization, signature);
    await expect(
      publicClient.simulateContract({
        account: relayer,
        address: addresses.usdc,
        abi: USDC_ABI,
        functionName: 'transferWithAuthorization',
        args,
      })
    ).rejects.toThrow('FiatTokenV2: authorization is used or canceled');
    const second = await Wallet(accounts.relayer).writeContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'transferWithAuthorization',
      args,
      gas: 200_000n,
    });
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: second,
    });
    expect(receipt.status).toBe('reverted');
    await Context().Mine(1);

    // Verifying the reverted relay finds the one that used the authorization.
    await expect(
      ethereum.VerifyCheckoutPayment(second, expected, TIMEOUT)
    ).resolves.toMatchObject({
      status: 'verified',
      transaction_hash: first,
      payer_address: buyer,
    });
  });

  it('fails verification when the session authorization pays someone other than the merchant', async () => {
    const attacker = privateKeyToAccount(generatePrivateKey()).address;
    const { authorization, signature, expected } = await SignedPayment(
      700,
      attacker
    );

    const { hash } = await Relay(authorization, signature);
    await Context().Mine(1);

    await expect(
      ethereum.VerifyCheckoutPayment(hash, expected, TIMEOUT)
    ).resolves.toMatchObject({
      status: 'failed',
      transaction_hash: hash,
      failure_reason:
        'The authorized transfer does not pay the merchant wallet',
    });
    expect(await BalanceOf(attacker)).toBe(7_000_000n);
  });

  it('refuses to relay a signature with a tampered recipient and sends nothing', async () => {
    const attacker = privateKeyToAccount(generatePrivateKey()).address;
    const { authorization, signature } = await SignedPayment(800);
    const nonceBefore = await RelayerNonce();

    await expect(
      Relay({ ...authorization, to: attacker }, signature)
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringMatching(/FiatTokenV2: invalid signature/),
    });
    expect(await RelayerNonce()).toBe(nonceBefore);
    expect(await BalanceOf(attacker)).toBe(0n);
  });

  it('finds a payment someone else submitted first by its AuthorizationUsed log', async () => {
    const { publicClient, accounts, addresses } = Context();
    const { authorization, signature, expected } = await SignedPayment(900);
    const frontRun = await Wallet(accounts.deployer).writeContract({
      address: addresses.usdc,
      abi: USDC_ABI,
      functionName: 'transferWithAuthorization',
      args: CallArgs(authorization, signature),
    });
    await publicClient.waitForTransactionReceipt({ hash: frontRun });
    await Context().Mine(1);

    await expect(Relay(authorization, signature)).resolves.toEqual({
      hash: null,
      signed: [],
    });
    await expect(
      ethereum.VerifyCheckoutPayment(null, expected, TIMEOUT)
    ).resolves.toEqual({
      status: 'verified',
      transaction_hash: frontRun,
      amount_cents: 900,
      payer_address: buyer,
    });
  });

  it('completes a hosted checkout: payment_pending while confirming, then a retry with the hash', async () => {
    const previousTimeout = process.env.CHECKOUT_CONFIRM_TIMEOUT_MS;
    process.env.CHECKOUT_CONFIRM_TIMEOUT_MS = '1000';
    try {
      const memory = new MemoryDatabase();
      const db = memory.AsDatabase();
      const eventService = {
        Emit: jest.fn().mockResolvedValue(undefined),
      } as unknown as EventService;
      const productModule = new ProductModule(db);
      const paymentIntents = new PaymentIntentModule(db, eventService);
      const checkoutSessions = new CheckoutSessionModule(
        db,
        eventService,
        undefined,
        productModule,
        undefined,
        paymentIntents
      );
      const wallets = {
        GetDefaultWallet: jest.fn(async () => ({
          id: 'wa_z_merchant',
          wallet_address: merchant,
          network: 'ethereum',
          currency: 'usdc',
        })),
      } as unknown as ExternalWalletModule;
      const module = new CheckoutPaymentModule(
        db,
        checkoutSessions,
        wallets,
        productModule,
        paymentIntents,
        new ChargeModule(db, eventService),
        undefined,
        ethereum
      );
      const intent = paymentIntents.PaymentIntentObject('acct_z_platform', {
        amount: 1500,
        currency: 'usdc',
      });
      memory.Seed('PaymentIntents', { ...intent });
      const session: CheckoutSession = {
        ...checkoutSessions.CheckoutSessionObject(
          'acct_z_platform',
          {
            mode: 'payment',
            success_url: 'https://example.com/success',
          },
          [
            {
              id: 'li_z_anvil',
              object: 'item',
              amount_discount: 0,
              amount_subtotal: 1500,
              amount_tax: 0,
              amount_total: 1500,
              currency: 'usdc',
              description: 'Anvil checkout',
              discounts: null,
              metadata: {},
              price: null,
              quantity: 1,
              taxes: null,
            },
          ]
        ),
        payment_intent: intent.id,
      };
      memory.Seed('CheckoutSessions', { ...session });
      const merchantBefore = await BalanceOf(merchant);

      const prepared = await module.PreparePayment(session.url_slug, buyer, {
        email: 'buyer@example.com',
      });
      expect(prepared).toMatchObject({
        relayed: true,
        method: 'eip3009_transfer',
      });
      const signature = await Sign(prepared.typed_data ?? null);

      // No block is mined after the relay, so it cannot confirm in time.
      const pending = await module
        .ConfirmPayment(session.url_slug, { signature })
        .catch((error: unknown) => error);
      expect(pending).toMatchObject({
        statusCode: 409,
        type: 'payment_pending',
      });
      const hash = memory.Doc<CheckoutSession>('CheckoutSessions', session.id)
        .payment_details?.transaction_hash;
      expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(pending).toMatchObject({ details: { transaction_hash: hash } });
      expect(
        memory.Doc<PaymentIntent>('PaymentIntents', intent.id).status
      ).toBe('processing');

      await Context().Mine(1);
      const completed = await module.ConfirmPayment(session.url_slug, {
        transaction_hash: hash ?? undefined,
      });

      expect(completed).toMatchObject({
        status: 'complete',
        payment_details: {
          transaction_hash: hash,
          payer_wallet: buyer,
          relayed: true,
        },
      });
      expect(
        memory.Doc<PaymentIntent>('PaymentIntents', intent.id)
      ).toMatchObject({ status: 'succeeded', amount_received: 1500 });
      expect(
        memory.All<BalanceTransaction>('BalanceTransactions')
      ).toMatchObject([
        { type: 'payment', amount: 1500, metadata: { blockchain_tx: hash } },
      ]);
      expect(await BalanceOf(merchant)).toBe(merchantBefore + 15_000_000n);
    } finally {
      if (previousTimeout === undefined) {
        delete process.env.CHECKOUT_CONFIRM_TIMEOUT_MS;
      } else {
        process.env.CHECKOUT_CONFIRM_TIMEOUT_MS = previousTimeout;
      }
    }
  });
});
