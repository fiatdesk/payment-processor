// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Pure helpers for subscriptions on the Subscriptions contract: plan and
 * subscription ids, the EIP-2612 USDC permit and the EIP-712 `Subscribe` a
 * subscriber signs, the bounded permit allowance and receipt checks. Keys
 * are `keccak256(abi.encode(...))`, as in the contract. No RPC access.
 *
 * @module chains/SubscriptionAuthorization
 */

import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseEventLogs,
  toBytes,
  type Address,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { SameAddress, type Eip712TypedData } from '@zoneless/shared-types';
import { SUBSCRIPTIONS_ABI } from './abi/Subscriptions';
import type { UsdcDomain } from './CheckoutAuthorization';

/** How long a subscribe signature stays valid at most. */
export const SUBSCRIBE_DEADLINE_SECONDS = 1800;
/** The permit covers at least this many periods... */
const PERMIT_MIN_PERIODS = 12n;
/** ...and at least a year of service. */
const PERMIT_MIN_SECONDS = 365n * 24n * 3600n;

/** The Subscriptions contract's EIP-712 domain: `Subscriptions`, version 1. */
export interface SubscriptionsDomain {
  name: 'Subscriptions';
  version: '1';
  chainId: number;
  verifyingContract: Address;
}

/** What a plan charges: the token, at most `amount` per `periodSeconds`. */
export interface PlanTerms {
  token: Address;
  amount: bigint;
  periodSeconds: bigint;
}

const DOMAIN_TYPE = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
  { name: 'chainId', type: 'uint256' },
  { name: 'verifyingContract', type: 'address' },
];

const PERMIT_TYPES = {
  EIP712Domain: DOMAIN_TYPE,
  Permit: [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

/** Field order matches the contract's `SUBSCRIBE_TYPEHASH`. */
const SUBSCRIBE_TYPES = {
  EIP712Domain: DOMAIN_TYPE,
  Subscribe: [
    { name: 'planKey', type: 'bytes32' },
    { name: 'subscriber', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'periodSeconds', type: 'uint64' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

/** The plan id of a recurring price: keccak256 of its UTF-8 id. */
export function PlanIdFromPriceId(priceId: string): Hex {
  return keccak256(toBytes(priceId));
}

/** `keccak256(abi.encode(owner, planId))`, the contract's plan key. */
export function PlanKeyFor(owner: string, planId: Hex): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'address' }, { type: 'bytes32' }],
      [getAddress(owner), planId]
    )
  );
}

/** `keccak256(abi.encode(planKey, subscriber))`, the subscription id. */
export function SubscriptionIdFor(planKey: Hex, subscriber: string): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'address' }],
      [planKey, getAddress(subscriber)]
    )
  );
}

/**
 * The allowance a subscriber's permit grants:
 * `amount × max(12, ceil(365 days / periodSeconds))`, so at least 12 periods
 * and at least a year of service. Never unlimited: a phished signature can
 * spend at most this.
 */
export function PermitValue(
  terms: Pick<PlanTerms, 'amount' | 'periodSeconds'>
): bigint {
  const yearOfPeriods =
    (PERMIT_MIN_SECONDS + terms.periodSeconds - 1n) / terms.periodSeconds;
  const periods =
    yearOfPeriods > PERMIT_MIN_PERIODS ? yearOfPeriods : PERMIT_MIN_PERIODS;
  return terms.amount * periods;
}

/** `min(expiresAt, now + 1800)`: a signature outlives neither. */
export function SubscribeDeadline(expiresAt: number, now: number): number {
  return Math.min(expiresAt, now + SUBSCRIBE_DEADLINE_SECONDS);
}

/**
 * The grid point a charge made at `now` collects: `nextChargeAt`, moved on
 * by the whole periods that passed since (the contract skips them). Before
 * `nextChargeAt` nothing is due, and `nextChargeAt` is returned.
 */
export function CurrentDueAt(
  nextChargeAt: number,
  now: number,
  periodSeconds: number
): number {
  if (now < nextChargeAt) return nextChargeAt;
  const missed = Math.floor((now - nextChargeAt) / periodSeconds);
  return nextChargeAt + missed * periodSeconds;
}

export function BuildSubscriptionsDomain(
  chainId: number,
  verifyingContract: Address
): SubscriptionsDomain {
  return { name: 'Subscriptions', version: '1', chainId, verifyingContract };
}

/** USDC `Permit` typed data for `eth_signTypedData_v4`. */
export function BuildPermitTypedData(
  domain: UsdcDomain,
  permit: {
    owner: Address;
    spender: Address;
    value: bigint;
    nonce: bigint;
    deadline: number;
  }
): Eip712TypedData {
  return {
    domain: { ...domain },
    types: structuredClone(PERMIT_TYPES),
    primaryType: 'Permit',
    message: {
      owner: permit.owner,
      spender: permit.spender,
      value: permit.value.toString(),
      nonce: permit.nonce.toString(),
      deadline: permit.deadline,
    },
  };
}

/**
 * The `Subscribe` typed data: the plan key and its terms, so the wallet
 * shows the token, amount and period being agreed to.
 */
export function BuildSubscribeTypedData(
  domain: SubscriptionsDomain,
  subscribe: {
    planKey: Hex;
    subscriber: Address;
    terms: PlanTerms;
    nonce: bigint;
    deadline: number;
  }
): Eip712TypedData {
  const { terms } = subscribe;
  return {
    domain: { ...domain },
    types: structuredClone(SUBSCRIBE_TYPES),
    primaryType: 'Subscribe',
    message: {
      planKey: subscribe.planKey,
      subscriber: subscribe.subscriber,
      token: terms.token,
      amount: terms.amount.toString(),
      periodSeconds: terms.periodSeconds.toString(),
      nonce: subscribe.nonce.toString(),
      deadline: subscribe.deadline,
    },
  };
}

/**
 * The subscription id of a successful receipt's `Subscribed(subId, planKey,
 * subscriber)` log from the Subscriptions contract, or null.
 */
export function FindSubscribedEvent(
  receipt: TransactionReceipt,
  expected: { subscriptions: string; planKey: Hex; subscriber: string }
): Hex | null {
  if (receipt.status !== 'success') return null;
  const logs = parseEventLogs({
    abi: SUBSCRIPTIONS_ABI,
    eventName: 'Subscribed',
    logs: receipt.logs.filter(
      (log) => !log.removed && SameAddress(log.address, expected.subscriptions)
    ),
    strict: true,
  });
  const log = logs.find(
    (candidate) =>
      candidate.args.planKey.toLowerCase() === expected.planKey.toLowerCase() &&
      SameAddress(candidate.args.subscriber, expected.subscriber)
  );
  return log ? log.args.subId : null;
}

/**
 * The next due time a successful receipt's `Charged(subId, …, amount,
 * nextChargeAt)` log from the Subscriptions contract reports, or null when
 * the receipt has no such log.
 */
export function FindChargedEvent(
  receipt: TransactionReceipt,
  expected: { subscriptions: string; subId: Hex; amount: bigint }
): number | null {
  if (receipt.status !== 'success') return null;
  const logs = parseEventLogs({
    abi: SUBSCRIPTIONS_ABI,
    eventName: 'Charged',
    logs: receipt.logs.filter(
      (log) => !log.removed && SameAddress(log.address, expected.subscriptions)
    ),
    strict: true,
  });
  const log = logs.find(
    (candidate) =>
      candidate.args.subId.toLowerCase() === expected.subId.toLowerCase() &&
      candidate.args.amount === expected.amount
  );
  return log ? Number(log.args.nextChargeAt) : null;
}
