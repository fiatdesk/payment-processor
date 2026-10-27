import { createHash } from 'node:crypto';
import { SyncEnvironment } from './EnvSync';
import { ApiError, InvalidInput } from './Errors';
import type { ProfileStore } from './ProfileStore';
import { GetWebhookSecretAccount, type SecretStore } from './SecretStore';
import type {
  WebhookEndpointListResponse,
  WebhookEndpointResponse,
  WebhookSyncCommand,
} from './Types';

const managedMetadataKey = 'fiatdesk_cli_managed';
const managedMetadataValue = 'webhook_sync';
const workspaceMetadataKey = 'fiatdesk_workspace_id';

export interface WebhookClient {
  CreateWebhookEndpoint(
    body: Record<string, unknown>,
    idempotencyKey: string
  ): Promise<WebhookEndpointResponse>;
  ListWebhookEndpoints(): Promise<WebhookEndpointListResponse>;
  UpdateWebhookEndpoint(
    id: string,
    body: Record<string, unknown>
  ): Promise<WebhookEndpointResponse>;
}

export interface WebhookSyncOptions {
  command: WebhookSyncCommand;
  profileName: string;
  profileStore: ProfileStore;
  projectDirectory: string;
  secretStore: SecretStore;
  workspaceId: string;
}

export interface WebhookSyncResult {
  created: boolean;
  dashboard_url: string | null;
  enabled_events: string[];
  endpoint_id: string;
  mode: 'live' | 'test';
  object: 'webhook_sync';
  ok: true;
  profile: string;
  restart_required: true;
  target: string;
  url: string;
  written: string[];
}

export async function SyncWebhook(
  client: WebhookClient,
  options: WebhookSyncOptions
): Promise<WebhookSyncResult> {
  const { command, profileName, workspaceId } = options;
  const endpoints = await client.ListWebhookEndpoints();
  const managedEndpoints = endpoints.data.filter((endpoint) =>
    IsManagedEndpoint(endpoint, workspaceId)
  );
  if (managedEndpoints.length > 1) {
    throw InvalidInput(
      'Multiple CLI-managed webhook endpoints were found for this project. Remove the duplicates in the FiatDesk dashboard, then retry.'
    );
  }

  let endpoint = managedEndpoints[0];
  let created = false;
  let webhookSecret: string | null = null;

  if (endpoint) {
    webhookSecret = await options.secretStore.Get(
      GetWebhookSecretAccount(profileName, endpoint.id)
    );
    if (!webhookSecret) {
      throw InvalidInput(
        `The signing secret for webhook endpoint "${endpoint.id}" is not available locally. Delete that CLI-managed endpoint in the FiatDesk dashboard and rerun webhook sync, or configure FIATDESK_WEBHOOK_SECRET manually.`
      );
    }

    if (
      endpoint.url !== command.url ||
      !SameEvents(endpoint.enabled_events, command.events) ||
      endpoint.status !== 'enabled'
    ) {
      endpoint = await client.UpdateWebhookEndpoint(endpoint.id, {
        disabled: false,
        enabled_events: command.events,
        metadata: {
          ...(endpoint.metadata ?? {}),
          ...ManagedMetadata(workspaceId),
        },
        url: command.url,
      });
    }
  } else {
    const existingAtUrl = endpoints.data.find(
      (candidate) => candidate.url === command.url
    );
    if (existingAtUrl) {
      throw InvalidInput(
        `Webhook endpoint "${existingAtUrl.id}" already uses this URL, but its one-time signing secret is not managed by the CLI. Use its secret manually or delete it in the FiatDesk dashboard before running webhook sync.`
      );
    }

    const body = {
      description: 'Managed by FiatDesk CLI for subscription billing',
      enabled_events: command.events,
      metadata: ManagedMetadata(workspaceId),
      url: command.url,
    };
    endpoint = await client.CreateWebhookEndpoint(
      body,
      CreateIdempotencyKey(workspaceId, command.url, command.events)
    );
    webhookSecret = endpoint.secret ?? null;
    if (!webhookSecret) {
      throw new ApiError(
        'FiatDesk created the webhook endpoint without returning its signing secret.',
        0
      );
    }
    await options.secretStore.Set(
      GetWebhookSecretAccount(profileName, endpoint.id),
      webhookSecret
    );
    created = true;
  }

  const environment = await SyncEnvironment(
    {
      includeWallet: false,
      profileName,
      projectDirectory: options.projectDirectory,
      target: command.target,
      webhookSecret,
    },
    options.profileStore,
    options.secretStore
  );

  return {
    created,
    dashboard_url: DeriveDashboardUrl(
      (await options.profileStore.GetCredentials(profileName)).profile.apiUrl
    ),
    enabled_events: command.events,
    endpoint_id: endpoint.id,
    mode: environment.mode,
    object: 'webhook_sync',
    ok: true,
    profile: profileName,
    restart_required: true,
    target: environment.target,
    url: endpoint.url,
    written: environment.written,
  };
}

function IsManagedEndpoint(
  endpoint: WebhookEndpointResponse,
  workspaceId: string
): boolean {
  return (
    endpoint.metadata?.[managedMetadataKey] === managedMetadataValue &&
    endpoint.metadata?.[workspaceMetadataKey] === workspaceId
  );
}

function ManagedMetadata(workspaceId: string): Record<string, string> {
  return {
    [managedMetadataKey]: managedMetadataValue,
    [workspaceMetadataKey]: workspaceId,
  };
}

function SameEvents(left: string[], right: string[]): boolean {
  return [...left].sort().join('\n') === [...right].sort().join('\n');
}

function CreateIdempotencyKey(
  workspaceId: string,
  url: string,
  events: string[]
): string {
  const digest = createHash('sha256')
    .update(JSON.stringify({ events: [...events].sort(), url, workspaceId }))
    .digest('hex')
    .slice(0, 32);
  return `webhook-sync:${digest}`;
}

/**
 * Derives the developers dashboard URL from a profile's API URL by swapping
 * the leading `api.` / `api-test.` host label for `dashboard.` /
 * `dashboard-test.`. Returns null for any other host so callers can fall back
 * to generic wording instead of guessing.
 */
export function DeriveDashboardUrl(apiUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(apiUrl);
  } catch {
    return null;
  }
  const match = /^api(-test)?\.(.+)$/.exec(url.hostname);
  if (!match) {
    return null;
  }
  return `${url.protocol}//dashboard${match[1] ?? ''}.${
    match[2]
  }/account/developers`;
}
