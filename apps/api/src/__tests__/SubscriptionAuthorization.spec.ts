// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  concat,
  encodeAbiParameters,
  encodeEventTopics,
  hashTypedData,
  keccak256,
  recoverTypedDataAddress,
  toBytes,
  type Address,
  type Hex,
  type Log,
  type TransactionReceipt,
  type TypedDataDefinition,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  BuildPermitTypedData,
  BuildSubscribeTypedData,
  BuildSubscriptionsDomain,
  FindSubscribedEvent,
  PermitValue,
  PlanIdFromPriceId,
  PlanKeyFor,
  SubscribeDeadline,
  SubscriptionIdFor,
  type PlanTerms,
} from '../modules/chains/SubscriptionAuthorization';
import { SUBSCRIPTIONS_ABI } from '../modules/chains/abi/Subscriptions';
import type { UsdcDomain } from '../modules/chains/CheckoutAuthorization';

/** Anvil account #2 (the buyer; a public test key). */
const SUBSCRIBER_KEY: Hex =
  '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
const SUBSCRIBER = privateKeyToAccount(SUBSCRIBER_KEY).address;
const OPERATOR: Address = '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65';
const USDC: Address = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const SUBSCRIPTIONS: Address = '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
const OTHER: Address = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const USDC_DOMAIN: UsdcDomain = {
  name: 'USD Coin',
  version: '2',
  chainId: 31337,
  verifyingContract: USDC,
};
const DAY = 24n * 3600n;
const TERMS: PlanTerms = {
  token: USDC,
  amount: 20_000_000n,
  periodSeconds: 30n * DAY,
};

describe('SubscriptionAuthorization', () => {
  describe('ids and keys', () => {
    it('derives a deterministic 32-byte plan id from the price id', () => {
      const planId = PlanIdFromPriceId('price_fd_1');

      expect(planId).toBe(keccak256(toBytes('price_fd_1')));
      expect(planId).toMatch(/^0x[0-9a-f]{64}$/);
      expect(PlanIdFromPriceId('price_fd_1')).toBe(planId);
      expect(PlanIdFromPriceId('price_fd_2')).not.toBe(planId);
    });

    it('hashes plan keys and subscription ids with abi.encode', () => {
      const planId = PlanIdFromPriceId('price_fd_1');
      const planKey = PlanKeyFor(OPERATOR.toLowerCase(), planId);

      expect(planKey).toBe(
        keccak256(
          encodeAbiParameters(
            [{ type: 'address' }, { type: 'bytes32' }],
            [OPERATOR, planId]
          )
        )
      );
      expect(SubscriptionIdFor(planKey, SUBSCRIBER.toLowerCase())).toBe(
        keccak256(
          encodeAbiParameters(
            [{ type: 'bytes32' }, { type: 'address' }],
            [planKey, SUBSCRIBER]
          )
        )
      );
    });
  });

  describe('PermitValue', () => {
    it('allows at least 12 periods', () => {
      expect(PermitValue(TERMS)).toBe(20_000_000n * 13n);
      expect(PermitValue({ ...TERMS, periodSeconds: 365n * DAY })).toBe(
        20_000_000n * 12n
      );
    });

    it('allows at least a year of short periods, rounding up', () => {
      expect(PermitValue({ amount: 1_000_000n, periodSeconds: DAY })).toBe(
        365_000_000n
      );
      expect(PermitValue({ amount: 1_000_000n, periodSeconds: 7n * DAY })).toBe(
        53_000_000n
      );
    });
  });

  describe('SubscribeDeadline', () => {
    it('is 30 minutes from now, but never after the session expires', () => {
      expect(SubscribeDeadline(1_700_086_400, 1_700_000_000)).toBe(
        1_700_001_800
      );
      expect(SubscribeDeadline(1_700_000_900, 1_700_000_000)).toBe(
        1_700_000_900
      );
    });
  });

  describe('BuildPermitTypedData', () => {
    const typedData = BuildPermitTypedData(USDC_DOMAIN, {
      owner: SUBSCRIBER,
      spender: SUBSCRIPTIONS,
      value: 260_000_000n,
      nonce: 3n,
      deadline: 1_700_001_800,
    });

    it('is the EIP-2612 Permit of USDC for the Subscriptions contract', () => {
      expect(typedData).toEqual({
        domain: USDC_DOMAIN,
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Permit',
        message: {
          owner: SUBSCRIBER,
          spender: SUBSCRIPTIONS,
          value: '260000000',
          nonce: '3',
          deadline: 1_700_001_800,
        },
      });
    });

    it('survives a JSON round trip and recovers the signer', async () => {
      const json = JSON.parse(JSON.stringify(typedData));
      const signature = await privateKeyToAccount(SUBSCRIBER_KEY).signTypedData(
        json as TypedDataDefinition
      );

      await expect(
        recoverTypedDataAddress({
          ...(typedData as unknown as TypedDataDefinition),
          signature,
        })
      ).resolves.toBe(SUBSCRIBER);
    });
  });

  describe('BuildSubscribeTypedData', () => {
    const planKey = PlanKeyFor(OPERATOR, PlanIdFromPriceId('price_fd_1'));
    const domain = BuildSubscriptionsDomain(31337, SUBSCRIPTIONS);
    /** A 7-day trial: the first period is due a week after subscribe. */
    const FIRST_CHARGE_AT = 1_700_604_800;
    const typedData = BuildSubscribeTypedData(domain, {
      planKey,
      subscriber: SUBSCRIBER,
      terms: TERMS,
      firstChargeAt: FIRST_CHARGE_AT,
      nonce: 2n,
      deadline: 1_700_001_800,
    });

    it('uses the Subscriptions/1 domain and binds the plan terms and first charge time', () => {
      expect(typedData).toEqual({
        domain: {
          name: 'Subscriptions',
          version: '1',
          chainId: 31337,
          verifyingContract: SUBSCRIPTIONS,
        },
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
            { name: 'verifyingContract', type: 'address' },
          ],
          Subscribe: [
            { name: 'planKey', type: 'bytes32' },
            { name: 'subscriber', type: 'address' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'periodSeconds', type: 'uint64' },
            { name: 'firstChargeAt', type: 'uint64' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' },
          ],
        },
        primaryType: 'Subscribe',
        message: {
          planKey,
          subscriber: SUBSCRIBER,
          token: USDC,
          amount: '20000000',
          periodSeconds: '2592000',
          firstChargeAt: '1700604800',
          nonce: '2',
          deadline: 1_700_001_800,
        },
      });
    });

    it('hashes to the digest the contract checks', () => {
      const typeHash = keccak256(
        toBytes(
          'Subscribe(bytes32 planKey,address subscriber,address token,uint256 amount,uint64 periodSeconds,uint64 firstChargeAt,uint256 nonce,uint256 deadline)'
        )
      );
      const structHash = keccak256(
        encodeAbiParameters(
          [
            { type: 'bytes32' },
            { type: 'bytes32' },
            { type: 'address' },
            { type: 'address' },
            { type: 'uint256' },
            { type: 'uint64' },
            { type: 'uint64' },
            { type: 'uint256' },
            { type: 'uint256' },
          ],
          [
            typeHash,
            planKey,
            SUBSCRIBER,
            USDC,
            TERMS.amount,
            TERMS.periodSeconds,
            BigInt(FIRST_CHARGE_AT),
            2n,
            1_700_001_800n,
          ]
        )
      );
      const domainSeparator = keccak256(
        encodeAbiParameters(
          [
            { type: 'bytes32' },
            { type: 'bytes32' },
            { type: 'bytes32' },
            { type: 'uint256' },
            { type: 'address' },
          ],
          [
            keccak256(
              toBytes(
                'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'
              )
            ),
            keccak256(toBytes('Subscriptions')),
            keccak256(toBytes('1')),
            31337n,
            SUBSCRIPTIONS,
          ]
        )
      );

      expect(hashTypedData(typedData as unknown as TypedDataDefinition)).toBe(
        keccak256(concat(['0x1901', domainSeparator, structHash]))
      );
    });
  });

  describe('FindSubscribedEvent', () => {
    const planKey = PlanKeyFor(OPERATOR, PlanIdFromPriceId('price_fd_1'));
    const subId = SubscriptionIdFor(planKey, SUBSCRIBER);
    const expected = {
      subscriptions: SUBSCRIPTIONS,
      planKey,
      subscriber: SUBSCRIBER,
    };

    function SubscribedLog(
      overrides: {
        address?: Address;
        planKey?: Hex;
        subscriber?: Address;
        removed?: boolean;
      } = {}
    ): Log {
      const subscriber = overrides.subscriber ?? SUBSCRIBER;
      const key = overrides.planKey ?? planKey;
      return {
        address: overrides.address ?? SUBSCRIPTIONS,
        topics: encodeEventTopics({
          abi: SUBSCRIPTIONS_ABI,
          eventName: 'Subscribed',
          args: {
            subId: SubscriptionIdFor(key, subscriber),
            planKey: key,
            subscriber,
          },
        }) as Log['topics'],
        data: encodeAbiParameters([{ type: 'uint64' }], [1_700_000_000n]),
        blockHash: null,
        blockNumber: 10n,
        logIndex: 0,
        transactionHash: `0x${'aa'.repeat(32)}`,
        transactionIndex: 0,
        removed: overrides.removed ?? false,
      } as Log;
    }

    function Receipt(
      logs: Log[],
      status: 'success' | 'reverted' = 'success'
    ): TransactionReceipt {
      return { status, logs } as unknown as TransactionReceipt;
    }

    it('returns the subscription id of a matching Subscribed log', () => {
      expect(FindSubscribedEvent(Receipt([SubscribedLog()]), expected)).toBe(
        subId
      );
    });

    it.each([
      ['another contract', { address: OTHER }],
      ['another plan', { planKey: `0x${'11'.repeat(32)}` as Hex }],
      ['another subscriber', { subscriber: OTHER }],
      ['a removed log', { removed: true }],
    ])('ignores a log from %s', (_label, overrides) => {
      expect(
        FindSubscribedEvent(Receipt([SubscribedLog(overrides)]), expected)
      ).toBeNull();
    });

    it('returns null for a reverted receipt', () => {
      expect(
        FindSubscribedEvent(Receipt([SubscribedLog()], 'reverted'), expected)
      ).toBeNull();
    });
  });
});
