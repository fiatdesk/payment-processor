// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * ABI of contracts/src/PayoutBatch.sol, copied from the forge artifact
 * (contracts/out/PayoutBatch.sol/PayoutBatch.json) without bytecode or
 * metadata. Harness.anvil.spec.ts fails when the two drift; rebuild with
 * `npx nx run contracts:build` and copy the `abi` array again.
 *
 * @module chains/abi/PayoutBatch
 */

export const PAYOUT_BATCH_ABI = [
  {
    type: 'function',
    name: 'MAX_RECIPIENTS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'disperse',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'contract IERC20',
      },
      {
        name: 'recipients',
        type: 'address[]',
        internalType: 'address[]',
      },
      {
        name: 'amounts',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
      {
        name: 'batchId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'paid',
    inputs: [
      {
        name: 'payer',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'batchId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'BatchPaid',
    inputs: [
      {
        name: 'payer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'batchId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'count',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'total',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'BatchAlreadyPaid',
    inputs: [],
  },
  {
    type: 'error',
    name: 'BatchExpired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'EmptyBatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LengthMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'TooMany',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroBatchId',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroRecipient',
    inputs: [],
  },
] as const;
