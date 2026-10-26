import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// List Events Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Schema for listing events.
 * Events support filtering by creation timestamp, event type(s), and pagination.
 *
 * @see https://docs.zoneless.com/events/list
 */
export const ListEventsSchema = z
  .object({
    /** A limit on the number of objects to be returned (1-100, default: 10) */
    limit: z.number().int().min(1).max(100),
    /** Cursor for forward pagination */
    starting_after: z.string(),
    /** Cursor for backward pagination */
    ending_before: z.string(),
    /** Filter by creation timestamp */
    created: z
      .object({
        gt: z.number().int(),
        gte: z.number().int(),
        lt: z.number().int(),
        lte: z.number().int(),
      })
      .partial(),
    /** Only return events whose object has this ID (e.g. a payment intent or product ID) */
    related_object: z.string(),
    /** Specific event name or group using * as wildcard (e.g., 'account.*') */
    type: z.string(),
    /** Array of up to 20 specific event names (mutually exclusive with type) */
    types: z.array(z.string()).max(20),
  })
  .partial();

export type ListEventsInput = z.infer<typeof ListEventsSchema>;
