// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * Pure helpers for hosted checkout over EIP-3009: the authorization a
 * customer signs, its EIP-712 typed data, signature splitting and receipt
 * verification. The authorization nonce is `keccak256(session.id)`, so USDC
 * itself ties the transfer to the session and lets it run once. No RPC access.
 *
 * @module chains/CheckoutAuthorization
 */

import {
  getAddress,
  isHex,
  keccak256,
  parseEventLogs,
  toBytes,
  type Address,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import {
  SameAddress,
  type CheckoutTransferAuthorization,
  type Eip712TypedData,
} from '@fiatdesk/shared-types';
import { AppError } from '../../utils/AppError';
import { USDC_ABI } from './abi/Usdc';
import { CentsToTokenUnits } from './PayoutEncoding';
import type { CheckoutPaymentVerification } from './types';

/** The USDC EIP-712 domain: `name()` of the token, version "2". */
export interface UsdcDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

/** What a receipt says about a session's payment. */
export type CheckoutReceiptVerification = Omit<
  CheckoutPaymentVerification,
  'status' | 'transaction_hash'
> & { status: 'verified' | 'failed' };

const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  EIP712Domain: [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
    { name: 'verifyingContract', type: 'address' },
  ],
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

/** The EIP-3009 nonce of a checkout session: keccak256 of its UTF-8 id. */
export function SessionNonce(sessionId: string): Hex {
  return keccak256(toBytes(sessionId));
}

/**
 * The authorization that pays a session: `amountCents` of USDC from the
 * payer to the merchant, valid until the session expires.
 */
export function BuildTransferAuthorization(params: {
  payer: string;
  merchant: string;
  amountCents: number;
  sessionId: string;
  expiresAt: number;
}): CheckoutTransferAuthorization {
  return {
    from: getAddress(params.payer),
    to: getAddress(params.merchant),
    value: CentsToTokenUnits(params.amountCents).toString(),
    valid_after: 0,
    valid_before: params.expiresAt,
    nonce: SessionNonce(params.sessionId),
  };
}

/** Typed data for `eth_signTypedData_v4`; it survives a JSON round trip. */
export function BuildTransferAuthorizationTypedData(
  domain: UsdcDomain,
  authorization: CheckoutTransferAuthorization
): Eip712TypedData {
  return {
    domain: { ...domain },
    types: structuredClone(TRANSFER_WITH_AUTHORIZATION_TYPES),
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from,
      to: authorization.to,
      value: authorization.value,
      validAfter: authorization.valid_after,
      validBefore: authorization.valid_before,
      nonce: authorization.nonce,
    },
  };
}

/**
 * `v, r, s` of a 65-byte signature. Accepts a recovery byte of 27/28 or
 * 0/1 and returns `v` as 27/28, which USDC expects.
 */
export function SplitSignature(signature: string): {
  v: number;
  r: Hex;
  s: Hex;
} {
  if (!isHex(signature) || signature.length !== 132) {
    throw InvalidSignature();
  }
  const recovery = Number.parseInt(signature.slice(130), 16);
  const yParity = recovery >= 27 ? recovery - 27 : recovery;
  if (yParity !== 0 && yParity !== 1) throw InvalidSignature();
  return {
    v: 27 + yParity,
    r: `0x${signature.slice(2, 66)}`,
    s: `0x${signature.slice(66, 130)}`,
  };
}

/**
 * Verified when the receipt succeeded and USDC emitted
 * `AuthorizationUsed(authorizer, nonce)` (the session's nonce,
 * `SessionNonce(session.id)`) immediately followed by the
 * `Transfer(authorizer, merchant, value ≥ amount due)` of the same call. A
 * transfer to the merchant that no session authorization made does not
 * count, and logs in any other order fail. A transfer to one of `alsoPays`
 * (the caller's other accepted wallets) counts as paying the merchant;
 * `merchant_address` says which wallet was paid.
 */
export function VerifyCheckoutReceipt(
  receipt: TransactionReceipt,
  expected: {
    usdc: string;
    merchant: string;
    alsoPays?: string[];
    amountCents: number;
    nonce: Hex;
  }
): CheckoutReceiptVerification {
  if (receipt.status !== 'success') {
    return Failed('The payment transaction reverted');
  }
  const nonce = expected.nonce.toLowerCase();
  const logs = parseEventLogs({
    abi: USDC_ABI,
    logs: receipt.logs.filter(
      (log) => !log.removed && SameAddress(log.address, expected.usdc)
    ),
    strict: true,
  });
  const authorizations = logs.filter(
    (log) =>
      log.eventName === 'AuthorizationUsed' &&
      log.args.nonce.toLowerCase() === nonce
  );
  if (authorizations.length === 0) {
    return Failed(
      "The transaction does not use this Checkout Session's authorization"
    );
  }

  const due = CentsToTokenUnits(expected.amountCents);
  let failure: CheckoutReceiptVerification | null = null;
  for (const authorization of authorizations) {
    if (authorization.eventName !== 'AuthorizationUsed') continue;
    const authorizer = getAddress(authorization.args.authorizer);
    const transfer = logs.find(
      (log) => log.logIndex === authorization.logIndex + 1
    );
    if (
      transfer?.eventName !== 'Transfer' ||
      !SameAddress(transfer.args.from, authorizer)
    ) {
      failure ??= Failed(
        'No USDC transfer was made by the authorization',
        authorizer
      );
      continue;
    }
    const paid = [expected.merchant, ...(expected.alsoPays ?? [])].find(
      (wallet) => SameAddress(transfer.args.to, wallet)
    );
    if (!paid) {
      failure ??= Failed(
        'The authorized transfer does not pay the merchant wallet',
        authorizer
      );
      continue;
    }
    if (transfer.args.value < due) {
      failure ??= Failed(
        'The authorized transfer is below the amount due',
        authorizer
      );
      continue;
    }
    return {
      status: 'verified',
      amount_cents: Number(transfer.args.value / 10_000n),
      payer_address: authorizer,
      merchant_address: getAddress(transfer.args.to),
    };
  }
  return failure ?? Failed('No USDC transfer was made by the authorization');
}

function Failed(
  reason: string,
  payer: string | null = null
): CheckoutReceiptVerification {
  return {
    status: 'failed',
    amount_cents: 0,
    payer_address: payer,
    failure_reason: reason,
  };
}

function InvalidSignature(): AppError {
  return new AppError(
    'signature must be a 65-byte signature as 0x followed by 130 hex characters',
    400,
    'invalid_request_error'
  );
}
