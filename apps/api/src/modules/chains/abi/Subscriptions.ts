// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * ABI of contracts/src/Subscriptions.sol, copied from the forge artifact
 * (contracts/out/Subscriptions.sol/Subscriptions.json) without bytecode or
 * metadata. Harness.anvil.spec.ts fails when the two drift; rebuild with
 * `npx nx run contracts:build` and copy the `abi` array again.
 *
 * @module chains/abi/Subscriptions
 */

export const SUBSCRIPTIONS_ABI = [
  {
    type: 'constructor',
    inputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'MAX_PERIOD_SECONDS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint64',
        internalType: 'uint64',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'SUBSCRIBE_TYPEHASH',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'charge',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'createPlan',
    inputs: [
      {
        name: 'planId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'contract IERC20',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'periodSeconds',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'destination',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'puller',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'deactivatePlan',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'eip712Domain',
    inputs: [],
    outputs: [
      {
        name: 'fields',
        type: 'bytes1',
        internalType: 'bytes1',
      },
      {
        name: 'name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'version',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'verifyingContract',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'extensions',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nonces',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
    ],
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
    name: 'pause',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'plans',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'owner',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'puller',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'destination',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'contract IERC20',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'periodSeconds',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'active',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'resume',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPlanDestination',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'destination',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setPlanPuller',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'puller',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'subscribe',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'subId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'subscribeWithAuthorization',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'subscriber',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'terms',
        type: 'tuple',
        internalType: 'struct Subscriptions.Terms',
        components: [
          {
            name: 'token',
            type: 'address',
            internalType: 'contract IERC20',
          },
          {
            name: 'amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'periodSeconds',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'sig',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'subId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'subscribeWithPermit',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'subscriber',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'terms',
        type: 'tuple',
        internalType: 'struct Subscriptions.Terms',
        components: [
          {
            name: 'token',
            type: 'address',
            internalType: 'contract IERC20',
          },
          {
            name: 'amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'periodSeconds',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
      },
      {
        name: 'permitValue',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'permitDeadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'v',
        type: 'uint8',
        internalType: 'uint8',
      },
      {
        name: 'r',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'deadline',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'sig',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'subId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'subscriptions',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'subscriber',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'nextChargeAt',
        type: 'uint64',
        internalType: 'uint64',
      },
      {
        name: 'status',
        type: 'uint8',
        internalType: 'enum Subscriptions.Status',
      },
      {
        name: 'pausedBy',
        type: 'uint8',
        internalType: 'enum Subscriptions.PausedBy',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Canceled',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'by',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Charged',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'planKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'subscriber',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'destination',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'nextChargeAt',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EIP712DomainChanged',
    inputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Paused',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'by',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PlanCreated',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'planId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'token',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'periodSeconds',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
      {
        name: 'destination',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'puller',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PlanDeactivated',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PlanDestinationSet',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'destination',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PlanPullerSet',
    inputs: [
      {
        name: 'planKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'puller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Resumed',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'by',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'nextChargeAt',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Subscribed',
    inputs: [
      {
        name: 'subId',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'planKey',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'subscriber',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'nextChargeAt',
        type: 'uint64',
        indexed: false,
        internalType: 'uint64',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AlreadySubscribed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AmountExceedsPlan',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ExpiredSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidAccountNonce',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'currentNonce',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidPeriod',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidShortString',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotActive',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotDueYet',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PlanExists',
    inputs: [],
  },
  {
    type: 'error',
    name: 'PlanInactive',
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
    name: 'StringTooLong',
    inputs: [
      {
        name: 'str',
        type: 'string',
        internalType: 'string',
      },
    ],
  },
  {
    type: 'error',
    name: 'TermsMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
] as const;
