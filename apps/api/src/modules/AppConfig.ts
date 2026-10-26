// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * @fileOverview Application Infrastructure Configuration
 *
 * Static configuration from environment variables (.env).
 * These are deployment-specific settings that don't change at runtime.
 *
 * Secrets are managed via a single APP_SECRET which can be set via env var
 * or auto-generated and stored in the database. Purpose-specific keys
 * (JWT signing, encryption) are derived from this via the Encryption module.
 *
 * Usage:
 *   const { port, mongodbUri } = GetAppConfig();
 *
 * For derived keys:
 *   import { GetJwtSecret, GetEncryptionKey } from './AppConfig';
 *
 * For platform-specific configuration, use the Account and ExternalWallet modules.
 *
 * @module AppConfig
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomBytes } from 'crypto';
import type {
  AppConfig,
  AppSecrets,
  SettlementRail,
} from '@zoneless/shared-types';
import type { Hex } from 'viem';
import { DeriveKey } from './Encryption';

// Load environment variables first.
// Use cwd so this works for both `tsx` (src) and the webpack bundle (`dist/apps/api`).
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Re-export for convenience
export type { AppConfig, AppSecrets };

// Singleton config instance
let config: AppConfig | null = null;

// Cached derived keys
let cachedJwtSecret: string | null = null;
let cachedEncryptionKey: string | null = null;

// Collection name for app secrets
const SECRETS_COLLECTION = 'AppSecrets';
const SECRETS_ID = 'app_secrets';

// Key derivation info parameters
const HKDF_JWT_INFO = 'jwt-signing-key';
const HKDF_ENCRYPTION_INFO = 'encryption-key';

const MAINNET_CHAIN_ID = 1;
const SEPOLIA_CHAIN_ID = 11155111;
const ANVIL_CHAIN_ID = 31337;
const DEFAULT_CONFIRMATIONS = 2;

const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const PRIVATE_KEY_SETTINGS = [
  'CHECKOUT_RELAYER_KEY',
  'SUBSCRIPTION_OPERATOR_KEY',
] as const;
type PrivateKeySetting = (typeof PRIVATE_KEY_SETTINGS)[number];

export type SupportedChainId =
  | typeof MAINNET_CHAIN_ID
  | typeof SEPOLIA_CHAIN_ID
  | typeof ANVIL_CHAIN_ID;

/** Chain settings resolved from the environment (see GetChainConfig). */
export interface ChainEnvironment {
  chainId: SupportedChainId;
  rpcUrls: string[];
  confirmations: number;
}

/**
 * Generate a cryptographically secure random hex string.
 */
function GenerateSecureHex(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}

/**
 * Strip a trailing slash so URL joins stay consistent.
 */
function NormalizeOrigin(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * Test mode defaults to simulated settlement. Live mode is always on-chain.
 * SETTLEMENT_RAIL=onchain with LIVEMODE=false settles on Sepolia (or Anvil
 * when ETH_CHAIN_ID=31337).
 */
function ResolveSettlementRail(livemode: boolean): SettlementRail {
  const rail = (process.env.SETTLEMENT_RAIL || '').trim().toLowerCase();
  if (livemode) {
    if (rail === 'simulated') {
      throw new Error(
        'SETTLEMENT_RAIL=simulated is not valid when LIVEMODE=true'
      );
    }
    return 'onchain';
  }
  if (rail === 'onchain') return 'onchain';
  return 'simulated';
}

/** Live mode and settlement rail, after checking the private-key settings. */
function ReadRailSettings(): Pick<AppConfig, 'livemode' | 'settlement_rail'> {
  const livemode = process.env.LIVEMODE === 'true';

  // Fail at startup rather than on the first on-chain call.
  for (const name of PRIVATE_KEY_SETTINGS) ReadPrivateKey(name);

  return { livemode, settlement_rail: ResolveSettlementRail(livemode) };
}

/**
 * Build the base config from environment variables.
 * appSecret will be empty until InitializeAppConfig is called (if not in env).
 */
function BuildConfigFromEnv(): AppConfig {
  const dashboardUrl = NormalizeOrigin(
    process.env.DASHBOARD_URL ||
      `http://localhost:${process.env.DASHBOARD_PORT || '80'}`
  );
  const checkoutUrl = NormalizeOrigin(process.env.CHECKOUT_URL || dashboardUrl);
  const paymentLinkUrl = NormalizeOrigin(
    process.env.PAYMENT_LINK_URL || checkoutUrl
  );
  const railSettings = ReadRailSettings();
  // Fail at boot on a bad chain env (ETH_CHAIN_ID in live mode, a bad
  // ETH_CONFIRMATIONS) instead of on the first on-chain call.
  if (railSettings.settlement_rail === 'onchain') GetChainConfig();

  return {
    mongodbUri:
      process.env.MONGODB_URI ||
      'mongodb://localhost:27017/zoneless?replicaSet=rs0',
    dashboardUrl,
    checkoutUrl,
    paymentLinkUrl,
    appSecret: process.env.APP_SECRET || '',
    ...railSettings,
  };
}

/**
 * Check if the instance is in single-tenant mode.
 * When SINGLE_TENANT=true, only one platform can be created.
 * This is useful for self-hosted deployments.
 * Operator mode implies multi-tenant operation.
 */
export function IsSingleTenantMode(): boolean {
  if (IsOperatorMode()) {
    return false;
  }
  return process.env.SINGLE_TENANT !== 'false';
}

/**
 * Check if the instance is in operator mode (managed hosting).
 * When OPERATOR_API_KEY is set, public setup is disabled and platform
 * provisioning happens exclusively via the /v1/operator routes.
 */
export function IsOperatorMode(): boolean {
  return !!process.env.OPERATOR_API_KEY;
}

/**
 * Get the operator API key from the environment.
 * Only meaningful when IsOperatorMode() is true.
 */
export function GetOperatorApiKey(): string {
  return process.env.OPERATOR_API_KEY || '';
}

/**
 * Optional `0x` private key that relays EIP-3009 checkout authorizations and
 * subscription subscribe calls, paying their gas.
 */
export function GetCheckoutRelayerKey(): Hex | null {
  return ReadPrivateKey('CHECKOUT_RELAYER_KEY');
}

/** True when CHECKOUT_RELAYER_KEY is configured. */
export function IsCheckoutRelayed(): boolean {
  return !!GetCheckoutRelayerKey();
}

/**
 * `0x` private key that owns on-chain subscription plans and calls `charge`.
 * Required for recurring prices.
 */
export function RequireSubscriptionOperatorKey(): Hex {
  const privateKey = ReadPrivateKey('SUBSCRIPTION_OPERATOR_KEY');
  if (!privateKey) {
    throw new Error(
      'SUBSCRIPTION_OPERATOR_KEY is required for recurring subscription plans'
    );
  }
  return privateKey;
}

/**
 * Chain id, RPC URLs and confirmation depth for the on-chain rail.
 * Live mode is Ethereum mainnet; test mode is Sepolia unless ETH_CHAIN_ID
 * selects Anvil. RPC URLs may be empty here; clients require them.
 */
export function GetChainConfig(): ChainEnvironment {
  const livemode = process.env.LIVEMODE === 'true';
  return {
    chainId: ResolveChainId(livemode),
    rpcUrls: (process.env.ETH_RPC_URL || '')
      .split(',')
      .map((url) => url.trim())
      .filter((url) => url.length > 0),
    confirmations: ResolveConfirmations(),
  };
}

function ResolveChainId(livemode: boolean): SupportedChainId {
  const override = (process.env.ETH_CHAIN_ID || '').trim();
  if (livemode) {
    if (override) {
      throw new Error('ETH_CHAIN_ID is only allowed when LIVEMODE=false');
    }
    return MAINNET_CHAIN_ID;
  }
  if (!override || override === String(SEPOLIA_CHAIN_ID)) {
    return SEPOLIA_CHAIN_ID;
  }
  if (override === String(ANVIL_CHAIN_ID)) return ANVIL_CHAIN_ID;
  throw new Error('ETH_CHAIN_ID must be 11155111 (Sepolia) or 31337 (Anvil)');
}

function ResolveConfirmations(): number {
  const value = (process.env.ETH_CONFIRMATIONS || '').trim();
  if (!value) return DEFAULT_CONFIRMATIONS;
  const confirmations = Number(value);
  if (!Number.isInteger(confirmations) || confirmations < 1) {
    throw new Error('ETH_CONFIRMATIONS must be a positive integer');
  }
  return confirmations;
}

/** Reads an optional private-key setting, rejecting anything not `0x` + 64 hex. */
function ReadPrivateKey(name: PrivateKeySetting): Hex | null {
  const value = (process.env[name] || '').trim();
  if (!value) return null;
  if (!PRIVATE_KEY_PATTERN.test(value)) {
    throw new Error(`${name} must be 0x followed by 64 hex characters`);
  }
  return value as Hex;
}

/**
 * Get application infrastructure configuration.
 * Before InitializeAppConfig() is called, appSecret may be empty.
 * After InitializeAppConfig(), appSecret is guaranteed to be set.
 *
 * @example
 * const { port, mongodbUri } = GetAppConfig();
 */
export function GetAppConfig(): AppConfig {
  if (!config) {
    config = BuildConfigFromEnv();
  }
  return config;
}

/**
 * Test hook: re-reads LIVEMODE and SETTLEMENT_RAIL into the memoised config
 * (the same object every caller holds), keeping its app secret. Called by
 * ResetChainClientsForTests() so a spec that switches the env to a chain
 * really gets that rail.
 */
export function ReloadRailSettingsForTests(): void {
  if (config) Object.assign(config, ReadRailSettings());
}

/**
 * Get the JWT signing secret (derived from appSecret via HKDF).
 * Throws if app secret has not been initialized.
 */
export function GetJwtSecret(): string {
  if (!cachedJwtSecret) {
    const { appSecret } = GetAppConfig();
    if (!appSecret) {
      throw new Error(
        'App secret not initialized. Call InitializeAppConfig() first.'
      );
    }
    cachedJwtSecret = DeriveKey(appSecret, HKDF_JWT_INFO, 64); // 512 bits
  }
  return cachedJwtSecret;
}

/**
 * Get the encryption key (derived from appSecret via HKDF).
 * Throws if app secret has not been initialized.
 */
export function GetEncryptionKey(): string {
  if (!cachedEncryptionKey) {
    const { appSecret } = GetAppConfig();
    if (!appSecret) {
      throw new Error(
        'App secret not initialized. Call InitializeAppConfig() first.'
      );
    }
    cachedEncryptionKey = DeriveKey(appSecret, HKDF_ENCRYPTION_INFO, 32); // 256 bits
  }
  return cachedEncryptionKey;
}

/**
 * Initialize app secret from env or database.
 * Must be called once at startup after Database is connected.
 *
 * If APP_SECRET is not in env, loads from DB or auto-generates.
 *
 * @param db - Database instance with Get/Set methods
 */
export async function InitializeAppConfig(db: {
  Get: <T>(collection: string, id: string) => Promise<T | null>;
  Set: <T>(
    collection: string,
    id: string,
    doc: Partial<T>
  ) => Promise<T | null>;
}): Promise<AppConfig> {
  // Ensure config is initialized
  const currentConfig = GetAppConfig();

  // If already has appSecret (from env), we're done
  if (currentConfig.appSecret) {
    return currentConfig;
  }

  // Load or generate from database
  let secrets = await db.Get<AppSecrets>(SECRETS_COLLECTION, SECRETS_ID);

  if (!secrets) {
    // Generate new master secret (512 bits = 64 bytes)
    secrets = {
      id: SECRETS_ID,
      object: 'app_secrets',
      app_secret: GenerateSecureHex(64),
      created: Math.floor(Date.now() / 1000),
    };
    await db.Set<AppSecrets>(SECRETS_COLLECTION, SECRETS_ID, secrets);
  }

  currentConfig.appSecret = secrets.app_secret;
  return currentConfig;
}

/**
 * Check if app config has been initialized with a secret.
 */
export function IsAppConfigInitialized(): boolean {
  return config !== null && !!config.appSecret;
}
