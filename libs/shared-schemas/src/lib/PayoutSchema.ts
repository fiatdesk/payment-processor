import { z } from 'zod';
import { TRANSACTION_HASH_PATTERN } from '@zoneless/shared-types';

/**
 * Schema for creating a payout.
 * Amount is required, destination is optional (uses default wallet if not specified).
 * Matches Stripe's POST /v1/payouts parameters.
 *
 * @see https://docs.stripe.com/api/payouts/create
 */
export const CreatePayoutSchema = z.object({
  /** A positive integer in cents representing how much to payout */
  amount: z
    .number()
    .int('Amount must be an integer (cents)')
    .positive('Amount must be positive'),

  /** Three-letter ISO currency code. Defaults to 'usdc' */
  currency: z.string().default('usdc'),

  /** The ID of an external wallet to send the payout to */
  destination: z
    .string()
    .min(1, 'Destination wallet ID is required')
    .optional(),

  /** An arbitrary string attached to the object */
  description: z.string().optional(),

  /** The method used to send this payout: 'standard' or 'instant' */
  method: z.enum(['standard', 'instant']).default('instant').optional(),

  /** Set of key-value pairs to store with the payout */
  metadata: z.record(z.string(), z.string()).optional(),

  /**
   * A string that displays on the recipient's statement (up to 22 characters).
   * For crypto, this may be included in transaction metadata where supported.
   */
  statement_descriptor: z
    .string()
    .max(22, 'Statement descriptor must be 22 characters or less')
    .optional(),
});

export type CreatePayoutInput = z.infer<typeof CreatePayoutSchema>;

/**
 * Schema for updating a payout.
 * Only metadata can be updated after creation (matching Stripe's API).
 *
 * @see https://docs.stripe.com/api/payouts/update
 */
export const UpdatePayoutSchema = z
  .object({
    /** Set of key-value pairs to update on the payout */
    metadata: z.record(z.string(), z.string()),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type UpdatePayoutInput = z.infer<typeof UpdatePayoutSchema>;

/**
 * Schema for listing payouts.
 * @see https://docs.stripe.com/api/payouts/list
 */
export const ListPayoutsSchema = z.object({
  /** A limit on the number of objects to be returned. Limit can range between 1 and 100, and the default is 10 */
  limit: z.number().int().min(1).max(100).optional(),

  /** A cursor for use in pagination. starting_after is an object ID that defines your place in the list */
  starting_after: z.string().optional(),

  /** A cursor for use in pagination. ending_before is an object ID that defines your place in the list */
  ending_before: z.string().optional(),

  /** The ID of an external wallet—only return payouts sent to this wallet */
  destination: z.string().optional(),

  /** Only return payouts that have the given status */
  status: z
    .enum(['pending', 'in_transit', 'paid', 'failed', 'canceled'])
    .optional(),

  /** Only return payouts that arrived during the given date interval */
  arrival_date: z
    .object({
      gt: z.number().optional(),
      gte: z.number().optional(),
      lt: z.number().optional(),
      lte: z.number().optional(),
    })
    .optional(),

  /** Only return payouts that were created during the given date interval */
  created: z
    .object({
      gt: z.number().optional(),
      gte: z.number().optional(),
      lt: z.number().optional(),
      lte: z.number().optional(),
    })
    .optional(),
});

export type ListPayoutsInput = z.infer<typeof ListPayoutsSchema>;

/** Maximum payouts in one batch transaction (about 5.1 M gas on Ethereum). */
export const MAX_BATCH_PAYOUTS = 100;

/** Bounds of a batch's on-chain deadline window, in seconds. */
export const MIN_PAYOUT_DEADLINE_SECONDS = 120;
export const MAX_PAYOUT_DEADLINE_SECONDS = 86400;

const PayoutIdsSchema = z
  .array(z.string().min(1, 'Payout ID cannot be empty'))
  .max(
    MAX_BATCH_PAYOUTS,
    `Maximum ${MAX_BATCH_PAYOUTS} payouts per batch transaction`
  );

/**
 * Schema for building a batch payout transaction.
 * Takes an array of pending payout IDs and returns an unsigned transaction.
 */
export const BuildPayoutsBatchSchema = z.object({
  /** Array of payout IDs to include in the batch transaction */
  payouts: PayoutIdsSchema.min(1, 'At least one payout ID is required'),

  /**
   * Supersede the wallet's outstanding batch: re-price it at the same nonce
   * with higher fees, or replace a batch that was built but never broadcast.
   */
  replace: z.boolean().optional(),

  /**
   * Seconds the transaction stays executable on-chain. Its payouts are held
   * until it is paid or this deadline passes. Defaults to
   * PAYOUT_BUILD_DEADLINE_SECONDS (1800).
   */
  deadline_seconds: z
    .number()
    .int()
    .min(MIN_PAYOUT_DEADLINE_SECONDS)
    .max(MAX_PAYOUT_DEADLINE_SECONDS)
    .optional(),
});

export type BuildPayoutsBatchInput = z.infer<typeof BuildPayoutsBatchSchema>;

/**
 * Schema for broadcasting a batch payout transaction. Send either the signed
 * transaction (the API submits it) or the hash of a transaction your wallet
 * already submitted, never both.
 */
export const BroadcastPayoutsBatchSchema = z
  .object({
    /** The signed transaction, serialized for the active settlement rail */
    signed_transaction: z
      .string()
      .min(1, 'Signed transaction cannot be empty')
      .optional(),

    /** Hash of a transaction the platform wallet already broadcast */
    transaction_hash: z
      .string()
      .regex(TRANSACTION_HASH_PATTERN, 'Transaction hash must be 0x + 64 hex')
      .optional(),

    /**
     * Payout IDs in this transaction, matching the build. Empty for the
     * one-time approval transaction.
     */
    payouts: PayoutIdsSchema,
  })
  .refine(
    (data) =>
      (data.signed_transaction === undefined) !==
      (data.transaction_hash === undefined),
    {
      message: 'Provide exactly one of signed_transaction or transaction_hash',
      path: ['signed_transaction'],
    }
  );

export type BroadcastPayoutsBatchInput = z.infer<
  typeof BroadcastPayoutsBatchSchema
>;
