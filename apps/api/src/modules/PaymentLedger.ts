// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview Records confirmed on-chain payments on the merchant's ledger
 *
 * A checkout session or invoice paid on-chain gets a `payment` balance
 * transaction and credits the merchant's available balance, atomically.
 * Its USDC reached a platform wallet as a Transfer the top-up scan also
 * sees; if the scan credited it first, the credit is reversed in the same
 * transaction, so the payment is counted once.
 *
 * @module PaymentLedger
 */

import { ClientSession } from 'mongoose';
import type { BalanceTransaction } from '@fiatdesk/shared-types';
import { Database } from './Database';
import { BalanceModule } from './Balance';
import { BalanceTransactionModule } from './BalanceTransaction';
import { EventService } from './EventService';
import { TopUpModule } from './TopUp';
import type { Settlement } from './chains/Settlement';
import { Logger } from '../utils/Logger';
import { Now } from '../utils/Timestamp';

/** Invoices collected before a hash was recorded carry this placeholder. */
const NO_TRANSACTION = 'already_collected';

export interface OnchainPayment {
  /** The checkout session or invoice id */
  source: string;
  description: string;
  account: string;
  amountCents: number;
  currency: string;
  payerWallet: string | null;
  transactionHash: string;
}

/**
 * Credits the payment once. Idempotent: an existing payment balance
 * transaction for the source is returned without crediting again.
 */
export async function RecordOnchainPayment(
  db: Database,
  settlement: Settlement,
  payment: OnchainPayment
): Promise<BalanceTransaction> {
  const [existing] = await db.Find2Custom<BalanceTransaction>(
    'BalanceTransactions',
    'source',
    '==',
    payment.source,
    'type',
    '==',
    'payment'
  );
  if (existing) return existing;

  const balanceModule = new BalanceModule(db);
  const topUpModule = new TopUpModule(db, new EventService(db));
  const { transactionHash } = payment;
  const onChain = !!transactionHash && transactionHash !== NO_TRANSACTION;
  const timestamp = Now();

  const balanceTransaction = new BalanceTransactionModule(
    db
  ).BalanceTransactionObject({
    amount: payment.amountCents,
    currency: payment.currency,
    account: payment.account,
    platformAccountId: payment.account,
    type: 'payment',
    source: payment.source,
    description: payment.description,
    metadata: {
      blockchain_tx: transactionHash,
      network: settlement.Describe().network,
      sender_address: payment.payerWallet ?? '',
      explorer_url: onChain
        ? settlement.ExplorerUrl('tx', transactionHash)
        : '',
    },
    status: 'available',
    available_on: timestamp,
  });

  // The merchant may not have a ledger balance yet (e.g. fresh setup)
  const initialBalance =
    (await balanceModule.GetBalance(payment.account)) ??
    (await balanceModule.CreateBalance(payment.account));

  const reversal = await db.RunTransaction(async (session: ClientSession) => {
    const balanceData =
      (await balanceModule.GetBalance(payment.account, session)) ??
      initialBalance;
    const reversed = onChain
      ? await topUpModule.ReverseDepositCredits(
          transactionHash,
          payment.account,
          session
        )
      : { amount: 0, topUps: [] };

    await db.Set(
      'BalanceTransactions',
      balanceTransaction.id,
      balanceTransaction,
      session
    );
    const updatedBalance = balanceModule.UpdateBalance(
      balanceData,
      payment.amountCents - reversed.amount,
      balanceTransaction.currency,
      'available'
    );
    await db.Update(
      'Balances',
      updatedBalance.id,
      { available: updatedBalance.available },
      session
    );
    return reversed;
  });

  if (reversal.amount > 0) {
    Logger.warn('A payment was already credited as a deposit; reversed it', {
      source: payment.source,
      transactionHash,
      reversedCents: reversal.amount,
    });
    await topUpModule.EmitReversed(reversal);
  }
  Logger.info('Recorded payment on ledger', {
    source: payment.source,
    balanceTransactionId: balanceTransaction.id,
    amountCents: payment.amountCents,
  });

  return balanceTransaction;
}
