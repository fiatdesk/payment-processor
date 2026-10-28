// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import type { Price } from '@fiatdesk/shared-types';
import { PlanDestinationModule } from '../modules/PlanDestination';
import { AppError } from '../utils/AppError';
import type { Settlement } from '../modules/chains/Settlement';
import { MemoryDatabase } from './mocks/MemoryDatabase';
import {
  CreateMockSettlement,
  MOCK_DESTINATION_HASH,
} from './mocks/Settlement';
import { GetFixedTimestamp } from './Setup';

let mockNow = GetFixedTimestamp();
jest.mock('../utils/Timestamp', () => ({
  Now: jest.fn(() => mockNow),
}));
jest.mock('../utils/Logger', () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const PLATFORM = 'acct_fd_platform';
const OLD_WALLET = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const NEW_WALLET = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
const PLAN_KEY = `0x${'a1'.repeat(32)}`;
const REPLACEMENT = `0x${'d6'.repeat(32)}`;

function RecurringPrice(overrides: Partial<Price> = {}): Price {
  return {
    id: 'price_fd_plan',
    object: 'price',
    active: true,
    currency: 'usdc',
    metadata: {},
    nickname: null,
    product: 'prod_fd_1',
    recurring: {
      interval: 'month',
      interval_count: 1,
      trial_period_days: null,
      usage_type: 'licensed',
      meter: null,
    },
    tax_behavior: 'unspecified',
    type: 'recurring',
    unit_amount: 2000,
    billing_scheme: 'per_unit',
    created: 1,
    custom_unit_amount: null,
    livemode: false,
    lookup_key: null,
    tiers_mode: null,
    unit_amount_decimal: '2000',
    platform_account: PLATFORM,
    subscription_plan_id: PLAN_KEY,
    subscription_plan_destination: OLD_WALLET,
    subscription_plan_destination_change: null,
    ...overrides,
  };
}

describe('PlanDestinationModule', () => {
  let memory: MemoryDatabase;
  let settlement: jest.Mocked<Settlement>;
  let emit: jest.Mock;
  let module: PlanDestinationModule;

  beforeEach(() => {
    mockNow = GetFixedTimestamp();
    memory = new MemoryDatabase();
    settlement = CreateMockSettlement();
    emit = jest.fn().mockResolvedValue(undefined);
    memory.Seed('ExternalWallets', {
      id: 'wa_fd_new',
      account: PLATFORM,
      wallet_address: NEW_WALLET,
      default_for_currency: true,
      status: 'new',
    });
    module = Module();
  });

  function Module(): PlanDestinationModule {
    return new PlanDestinationModule(memory.AsDatabase(), settlement, {
      Emit: emit,
    } as never);
  }

  function SeedPrices(...prices: Price[]): void {
    memory.Seed('Prices', ...(prices as unknown as Record<string, unknown>[]));
  }

  function Stored(id = 'price_fd_plan'): Price {
    return memory.Doc<Price>('Prices', id);
  }

  /** The rail sends the change: records its hash, then leaves it pending. */
  function SendsAndWaits(): void {
    settlement.SetPlanDestination.mockImplementation(
      async (_planKey, _destination, options) => {
        if (options.pendingHash) {
          return { status: 'pending', transaction_hash: options.pendingHash };
        }
        await options.onSigned(MOCK_DESTINATION_HASH);
        return { status: 'pending', transaction_hash: MOCK_DESTINATION_HASH };
      }
    );
  }

  describe('the migration record', () => {
    it('records a pending change before anything is sent', async () => {
      SeedPrices(RecurringPrice());

      await module.Request(RecurringPrice(), NEW_WALLET);

      expect(Stored().subscription_plan_destination_change).toEqual({
        destination: NEW_WALLET,
        transaction_hash: null,
        status: 'pending',
        created: GetFixedTimestamp(),
        failure_message: null,
        sent_at: null,
      });
      expect(Stored().subscription_plan_destination).toBe(OLD_WALLET);
      expect(settlement.SetPlanDestination).not.toHaveBeenCalled();
    });

    it('is idempotent for the same destination and keeps one change in flight', async () => {
      SeedPrices(RecurringPrice());
      await module.Request(RecurringPrice(), NEW_WALLET);
      const first = Stored().subscription_plan_destination_change;
      mockNow += 60;

      await expect(module.Request(Stored(), NEW_WALLET)).resolves.toMatchObject(
        {
          subscription_plan_destination_change: first,
        }
      );
      // Another destination waits for the change in flight.
      await expect(module.Request(Stored(), OLD_WALLET)).resolves.toBeNull();
      expect(Stored().subscription_plan_destination_change).toEqual(first);
    });
  });

  describe('Enqueue', () => {
    it('records a change for each active on-chain plan, and none for inactive, one-time or simulated plans', async () => {
      SeedPrices(
        RecurringPrice({ id: 'price_fd_a' }),
        RecurringPrice({ id: 'price_fd_b' }),
        RecurringPrice({ id: 'price_fd_inactive', active: false }),
        RecurringPrice({
          id: 'price_fd_sim',
          subscription_plan_id: 'sim_plan_price_fd_sim',
        }),
        RecurringPrice({
          id: 'price_fd_one_time',
          type: 'one_time',
          recurring: null,
          subscription_plan_id: null,
        }),
        RecurringPrice({ id: 'price_fd_other', platform_account: 'acct_x' })
      );

      const ids = await module.Enqueue(PLATFORM, NEW_WALLET);

      const pending = memory
        .All<Price>('Prices')
        .filter(
          (price) =>
            price.subscription_plan_destination_change?.status === 'pending'
        )
        .map((price) => price.id);
      expect(pending.sort()).toEqual(['price_fd_a', 'price_fd_b']);
      expect(ids.sort()).toEqual(['price_fd_a', 'price_fd_b', 'price_fd_sim']);
    });
  });

  describe('Sync', () => {
    it('sends a recorded change and stays pending until it confirms; charges wait', async () => {
      SendsAndWaits();
      SeedPrices(RecurringPrice());
      await module.Request(RecurringPrice(), NEW_WALLET);

      await expect(module.ReadyToCharge(Stored())).resolves.toBe(false);

      expect(settlement.SetPlanDestination).toHaveBeenCalledWith(
        PLAN_KEY,
        NEW_WALLET,
        expect.objectContaining({ pendingHash: null, sentAt: null })
      );
      expect(Stored().subscription_plan_destination_change).toMatchObject({
        status: 'pending',
        transaction_hash: MOCK_DESTINATION_HASH,
        sent_at: GetFixedTimestamp(),
      });
      expect(Stored().subscription_plan_destination).toBe(OLD_WALLET);
      expect(emit).not.toHaveBeenCalled();
    });

    it('confirms a change by its hash: flips the destination and emits price.updated', async () => {
      SeedPrices(
        RecurringPrice({
          subscription_plan_destination_change: {
            destination: NEW_WALLET,
            transaction_hash: MOCK_DESTINATION_HASH,
            status: 'pending',
            created: 10,
            failure_message: null,
            sent_at: 11,
          },
        })
      );
      settlement.SetPlanDestination.mockResolvedValue({
        status: 'confirmed',
        transaction_hash: MOCK_DESTINATION_HASH,
      });

      await expect(module.ReadyToCharge(Stored())).resolves.toBe(true);

      expect(settlement.SetPlanDestination).toHaveBeenCalledWith(
        PLAN_KEY,
        NEW_WALLET,
        expect.objectContaining({
          pendingHash: MOCK_DESTINATION_HASH,
          sentAt: 11,
        })
      );
      const price = Stored();
      expect(price.subscription_plan_destination).toBe(NEW_WALLET);
      expect(price.subscription_plan_destination_change).toMatchObject({
        status: 'confirmed',
        transaction_hash: MOCK_DESTINATION_HASH,
      });
      expect(emit).toHaveBeenCalledWith('price.updated', PLATFORM, price, {
        previousAttributes: {
          subscription_plan_destination: OLD_WALLET,
          subscription_plan_destination_change: expect.objectContaining({
            status: 'pending',
          }),
        },
      });
    });

    it('records the re-priced replacement of a stuck change', async () => {
      SeedPrices(
        RecurringPrice({
          subscription_plan_destination_change: {
            destination: NEW_WALLET,
            transaction_hash: MOCK_DESTINATION_HASH,
            status: 'pending',
            created: 10,
            failure_message: null,
            sent_at: 11,
          },
        })
      );
      mockNow = 11 + 601;
      settlement.SetPlanDestination.mockImplementation(
        async (_planKey, _destination, options) => {
          await options.onSigned(REPLACEMENT);
          return { status: 'pending', transaction_hash: REPLACEMENT };
        }
      );

      await expect(module.ReadyToCharge(Stored())).resolves.toBe(false);

      expect(Stored().subscription_plan_destination_change).toMatchObject({
        status: 'pending',
        transaction_hash: REPLACEMENT,
        sent_at: 11 + 601,
      });
    });

    it('marks the change failed with plan_owner_mismatch, and charges go on', async () => {
      SeedPrices(
        RecurringPrice({
          subscription_plan_destination_change: {
            destination: NEW_WALLET,
            transaction_hash: null,
            status: 'pending',
            created: 10,
            failure_message: null,
            sent_at: null,
          },
        })
      );
      settlement.SetPlanDestination.mockRejectedValue(
        new AppError('not the owner', 409, 'plan_owner_mismatch')
      );

      await expect(module.ReadyToCharge(Stored())).resolves.toBe(true);

      expect(Stored().subscription_plan_destination_change).toMatchObject({
        status: 'failed',
        failure_message: 'plan_owner_mismatch',
      });
      expect(Stored().subscription_plan_destination).toBe(OLD_WALLET);
      // A failed change for the current default is not sent again.
      settlement.SetPlanDestination.mockClear();
      await expect(module.ReadyToCharge(Stored())).resolves.toBe(true);
      expect(settlement.SetPlanDestination).not.toHaveBeenCalled();
    });

    it('keeps the change pending when the rail cannot be reached', async () => {
      SeedPrices(
        RecurringPrice({
          subscription_plan_destination_change: {
            destination: NEW_WALLET,
            transaction_hash: null,
            status: 'pending',
            created: 10,
            failure_message: null,
            sent_at: null,
          },
        })
      );
      settlement.SetPlanDestination.mockRejectedValue(
        new AppError('unavailable', 502, 'blockchain_error')
      );

      await expect(module.ReadyToCharge(Stored())).resolves.toBe(false);
      expect(Stored().subscription_plan_destination_change?.status).toBe(
        'pending'
      );
    });

    it('moves a plan that is not on the default wallet before it is charged', async () => {
      SendsAndWaits();
      SeedPrices(RecurringPrice());

      await expect(module.ReadyToCharge(Stored())).resolves.toBe(false);

      expect(Stored().subscription_plan_destination_change).toMatchObject({
        destination: NEW_WALLET,
        status: 'pending',
        transaction_hash: MOCK_DESTINATION_HASH,
      });
    });

    it('records the destination of a plan created before it was tracked, without an event', async () => {
      SeedPrices(RecurringPrice({ subscription_plan_destination: undefined }));

      await expect(module.ReadyToCharge(Stored())).resolves.toBe(true);

      expect(Stored().subscription_plan_destination).toBe(NEW_WALLET);
      expect(emit).not.toHaveBeenCalled();
    });

    it('flips the fields directly on the simulated rail', async () => {
      settlement.Describe.mockReturnValue({
        rail: 'simulated',
        network: 'simulated',
        chain_id: null,
        native_currency: 'none',
        token_address: 'simulated',
      });
      SeedPrices(
        RecurringPrice({ subscription_plan_id: 'sim_plan_price_fd_plan' })
      );

      await expect(module.ReadyToCharge(Stored())).resolves.toBe(true);

      expect(settlement.SetPlanDestination).not.toHaveBeenCalled();
      expect(Stored()).toMatchObject({
        subscription_plan_destination: NEW_WALLET,
        subscription_plan_destination_change: {
          destination: NEW_WALLET,
          transaction_hash: null,
          status: 'confirmed',
        },
      });
      expect(emit).toHaveBeenCalledWith(
        'price.updated',
        PLATFORM,
        expect.objectContaining({ id: 'price_fd_plan' }),
        {
          previousAttributes: {
            subscription_plan_destination: OLD_WALLET,
            subscription_plan_destination_change: null,
          },
        }
      );
    });

    it('needs no change for a one-time price', async () => {
      const oneTime = RecurringPrice({
        type: 'one_time',
        recurring: null,
        subscription_plan_id: null,
        subscription_plan_destination: null,
      });
      SeedPrices(oneTime);

      await expect(module.ReadyToCharge(oneTime)).resolves.toBe(true);
      expect(settlement.SetPlanDestination).not.toHaveBeenCalled();
    });
  });

  describe('ReconcilePending', () => {
    it("follows every pending change of the platform's plans", async () => {
      const pending = {
        destination: NEW_WALLET,
        transaction_hash: MOCK_DESTINATION_HASH,
        status: 'pending' as const,
        created: 10,
        failure_message: null,
        sent_at: 11,
      };
      SeedPrices(
        RecurringPrice({
          id: 'price_fd_a',
          subscription_plan_destination_change: pending,
        }),
        RecurringPrice({ id: 'price_fd_settled' }),
        RecurringPrice({
          id: 'price_fd_other',
          platform_account: 'acct_x',
          subscription_plan_destination_change: pending,
        })
      );
      settlement.SetPlanDestination.mockResolvedValue({
        status: 'confirmed',
        transaction_hash: MOCK_DESTINATION_HASH,
      });

      await module.ReconcilePending(PLATFORM);

      expect(settlement.SetPlanDestination).toHaveBeenCalledTimes(1);
      expect(Stored('price_fd_a').subscription_plan_destination).toBe(
        NEW_WALLET
      );
      expect(
        Stored('price_fd_other').subscription_plan_destination_change?.status
      ).toBe('pending');
    });
  });
});
