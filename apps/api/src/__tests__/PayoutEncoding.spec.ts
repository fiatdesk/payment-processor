// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  keccak256,
  toBytes,
  toFunctionSelector,
  type Address,
  type Hex,
  type Log,
  type TransactionReceipt,
} from 'viem';
import { PAYOUT_BATCH_ABI } from '../modules/chains/abi/PayoutBatch';
import {
  ComputeBatchId,
  EncodeDisperseCall,
  MapRevertToFailureCode,
  ParsePayoutReceipt,
} from '../modules/chains/PayoutEncoding';

const PAYOUT_BATCH: Address = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
const USDC: Address = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const PLATFORM: Address = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const RECIPIENT_A = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';
const RECIPIENT_B = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

function BatchPaidLog(
  batchId: Hex,
  count: bigint,
  total: bigint,
  address: Address = PAYOUT_BATCH
): Log {
  return {
    address,
    topics: encodeEventTopics({
      abi: PAYOUT_BATCH_ABI,
      eventName: 'BatchPaid',
      args: { payer: PLATFORM, token: USDC, batchId },
    }) as Log['topics'],
    data: encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'uint256' }],
      [count, total]
    ),
    blockHash: null,
    blockNumber: null,
    logIndex: null,
    transactionHash: null,
    transactionIndex: null,
    removed: false,
  };
}

function Receipt(logs: Log[]): TransactionReceipt {
  return { status: 'success', logs } as unknown as TransactionReceipt;
}

describe('ComputeBatchId', () => {
  it('hashes the sorted payout ids joined by commas', () => {
    expect(ComputeBatchId(['po_z_b', 'po_z_a'])).toBe(
      keccak256(toBytes('po_z_a,po_z_b'))
    );
  });

  it('does not depend on the order of the ids', () => {
    expect(ComputeBatchId(['po_z_3', 'po_z_1', 'po_z_2'])).toBe(
      ComputeBatchId(['po_z_2', 'po_z_3', 'po_z_1'])
    );
  });

  it('differs between payout sets and does not mutate its input', () => {
    const ids = ['po_z_2', 'po_z_1'];

    expect(ComputeBatchId(ids)).not.toBe(ComputeBatchId(['po_z_1']));
    expect(ids).toEqual(['po_z_2', 'po_z_1']);
  });
});

describe('EncodeDisperseCall', () => {
  const batchId = ComputeBatchId(['po_z_1', 'po_z_2']);
  const data = EncodeDisperseCall(
    USDC,
    [
      { destinationAddress: RECIPIENT_A.toLowerCase(), amountInCents: 1050 },
      { destinationAddress: RECIPIENT_B, amountInCents: 1 },
    ],
    batchId
  );

  it('calls disperse(address,address[],uint256[],bytes32)', () => {
    expect(data.slice(0, 10)).toBe(
      toFunctionSelector('disperse(address,address[],uint256[],bytes32)')
    );
  });

  it('encodes recipients, 6-decimal amounts and the batch id', () => {
    expect(decodeFunctionData({ abi: PAYOUT_BATCH_ABI, data })).toEqual({
      functionName: 'disperse',
      args: [USDC, [RECIPIENT_A, RECIPIENT_B], [10_500_000n, 10_000n], batchId],
    });
  });
});

describe('ParsePayoutReceipt', () => {
  const batchId = ComputeBatchId(['po_z_1', 'po_z_2']);
  const expected = { payoutBatch: PAYOUT_BATCH, batchId };

  it('matches the BatchPaid log of the batch and returns its count and total', () => {
    expect(
      ParsePayoutReceipt(
        Receipt([BatchPaidLog(batchId, 2n, 10_510_000n)]),
        expected
      )
    ).toEqual({ matched: true, count: 2, total: 10_510_000n });
  });

  it('ignores a BatchPaid log for another batch', () => {
    const other = ComputeBatchId(['po_z_9']);

    expect(
      ParsePayoutReceipt(Receipt([BatchPaidLog(other, 1n, 5n)]), expected)
    ).toEqual({ matched: false, count: 0, total: 0n });
  });

  it('ignores a BatchPaid log emitted by another contract', () => {
    const log = BatchPaidLog(batchId, 2n, 10_510_000n, USDC);

    expect(ParsePayoutReceipt(Receipt([log]), expected).matched).toBe(false);
  });

  it('does not match a receipt without logs', () => {
    expect(ParsePayoutReceipt(Receipt([]), expected).matched).toBe(false);
  });
});

describe('MapRevertToFailureCode', () => {
  it.each([
    'Blacklistable: account is blacklisted',
    'Execution reverted with reason: Blacklistable: account is BLACKLISTED.',
  ])('maps "%s" to account_frozen', (message) => {
    expect(MapRevertToFailureCode(message)).toBe('account_frozen');
  });

  it.each(['ERC20: transfer amount exceeds balance', 'out of gas', ''])(
    'maps "%s" to blockchain_error',
    (message) => {
      expect(MapRevertToFailureCode(message)).toBe('blockchain_error');
    }
  );
});
