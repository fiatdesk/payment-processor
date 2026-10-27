// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * The viem functions WalletService loads on first use. Importing this module
 * dynamically keeps wallet client and signing code out of the initial bundle
 * while still letting the bundler tree-shake viem.
 */
export { createWalletClient, custom, keccak256, parseTransaction } from 'viem';
export { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
export { sepolia } from 'viem/chains';
