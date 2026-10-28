import { z } from 'zod';
import { EthereumAddressSchema } from './AddressSchema';

/** `archive_previous` only replaces a default: it needs the new default. */
function ArchivePreviousNeedsDefault(data: {
  archive_previous?: boolean;
  default_for_currency?: boolean | null;
}): boolean {
  return !data.archive_previous || data.default_for_currency === true;
}

const ARCHIVE_PREVIOUS_ISSUE = {
  message: 'archive_previous can only be used with default_for_currency: true',
  path: ['archive_previous'],
};

/**
 * Schema for creating an external wallet.
 * Only wallet_address is required - other fields have sensible defaults.
 */
export const CreateExternalWalletSchema = z
  .object({
    wallet_address: EthereumAddressSchema,
    network: z.string().min(1, 'Network is required').optional(),
    currency: z
      .string()
      .min(3, 'Currency must be at least 3 characters')
      .max(4, 'Currency must be at most 4 characters')
      .optional(),
    account_holder_name: z.string().nullable().optional(),
    account_holder_type: z
      .enum(['individual', 'company'])
      .nullable()
      .optional(),
    default_for_currency: z.boolean().nullable().optional(),
    /**
     * FiatDesk extension: with `default_for_currency: true`, also delete the
     * previous default in the same step (a replacement).
     */
    archive_previous: z.boolean().optional(),
    metadata: z.record(z.string(), z.string()).optional(),
  })
  .refine(ArchivePreviousNeedsDefault, ARCHIVE_PREVIOUS_ISSUE);

export type CreateExternalWalletInput = z.infer<
  typeof CreateExternalWalletSchema
>;

/**
 * Schema for updating an external wallet.
 * All fields are optional - only provided fields will be updated.
 * Protected fields (id, object, account, last4, fingerprint) cannot be updated.
 */
export const UpdateExternalWalletSchema = z
  .object({
    account_holder_name: z.string().nullable(),
    account_holder_type: z.enum(['individual', 'company']).nullable(),
    default_for_currency: z.boolean().nullable(),
    /**
     * FiatDesk extension: with `default_for_currency: true`, also delete the
     * previous default in the same step (a replacement).
     */
    archive_previous: z.boolean(),
    metadata: z.record(z.string(), z.string()),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })
  .refine(ArchivePreviousNeedsDefault, ARCHIVE_PREVIOUS_ISSUE);

export type UpdateExternalWalletInput = z.infer<
  typeof UpdateExternalWalletSchema
>;

/**
 * Schema for listing external wallets with pagination.
 */
export const ListExternalWalletsSchema = z.object({
  limit: z.number().min(1).max(100).optional(),
  starting_after: z.string().optional(),
  ending_before: z.string().optional(),
  /** FiatDesk extension: each wallet carries its on-chain `usdc_balance`. */
  include_usdc_balance: z.boolean().optional(),
});

export type ListExternalWalletsInput = z.infer<
  typeof ListExternalWalletsSchema
>;
