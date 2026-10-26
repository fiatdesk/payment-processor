// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * ABIs for ERC-20 tokens and Circle USDC (FiatTokenV2: blacklist, EIP-2612
 * permit and EIP-3009 transfer authorizations).
 *
 * @module chains/abi/Usdc
 */

export const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'spender' },
      { type: 'uint256', name: 'value' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transferFrom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'from' },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'Transfer',
    type: 'event',
    inputs: [
      { type: 'address', name: 'from', indexed: true },
      { type: 'address', name: 'to', indexed: true },
      { type: 'uint256', name: 'value' },
    ],
  },
  {
    name: 'Approval',
    type: 'event',
    inputs: [
      { type: 'address', name: 'owner', indexed: true },
      { type: 'address', name: 'spender', indexed: true },
      { type: 'uint256', name: 'value' },
    ],
  },
] as const;

export const USDC_ABI = [
  ...ERC20_ABI,
  {
    name: 'isBlacklisted',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'authorizationState',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { type: 'address', name: 'authorizer' },
      { type: 'bytes32', name: 'nonce' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'transferWithAuthorization',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'from' },
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'value' },
      { type: 'uint256', name: 'validAfter' },
      { type: 'uint256', name: 'validBefore' },
      { type: 'bytes32', name: 'nonce' },
      { type: 'uint8', name: 'v' },
      { type: 'bytes32', name: 'r' },
      { type: 'bytes32', name: 's' },
    ],
    outputs: [],
  },
  {
    name: 'permit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'owner' },
      { type: 'address', name: 'spender' },
      { type: 'uint256', name: 'value' },
      { type: 'uint256', name: 'deadline' },
      { type: 'uint8', name: 'v' },
      { type: 'bytes32', name: 'r' },
      { type: 'bytes32', name: 's' },
    ],
    outputs: [],
  },
  {
    name: 'nonces',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'owner' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'DOMAIN_SEPARATOR',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    name: 'AuthorizationUsed',
    type: 'event',
    inputs: [
      { type: 'address', name: 'authorizer', indexed: true },
      { type: 'bytes32', name: 'nonce', indexed: true },
    ],
  },
] as const;
