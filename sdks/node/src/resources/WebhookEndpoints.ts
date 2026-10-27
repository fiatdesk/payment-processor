import { BaseResource } from './Base';
import {
  WebhookEndpoint,
  WebhookEndpointDeletedResponse,
  ListResponse,
} from '@fiatdesk/shared-types';
import type {
  CreateWebhookEndpointInput,
  UpdateWebhookEndpointInput,
  ListWebhookEndpointsInput,
} from '../generated/Inputs';
/**
 * @see /webhook-endpoints
 */
export class WebhookEndpoints extends BaseResource {
  /** @see /webhook-endpoints/create */
  async create(params: CreateWebhookEndpointInput): Promise<WebhookEndpoint> {
    return this.client.Post<WebhookEndpoint>('/webhook_endpoints', params);
  }

  /** @see /webhook-endpoints/retrieve */
  async retrieve(id: string): Promise<WebhookEndpoint> {
    return this.client.Get<WebhookEndpoint>(`/webhook_endpoints/${id}`);
  }

  /** @see /webhook-endpoints/update */
  async update(
    id: string,
    params: UpdateWebhookEndpointInput
  ): Promise<WebhookEndpoint> {
    return this.client.Post<WebhookEndpoint>(
      `/webhook_endpoints/${id}`,
      params
    );
  }

  /** @see /webhook-endpoints/delete */
  async del(id: string): Promise<WebhookEndpointDeletedResponse> {
    return this.client.Delete<WebhookEndpointDeletedResponse>(
      `/webhook_endpoints/${id}`
    );
  }

  /** @see /webhook-endpoints/list */
  async list(
    params: ListWebhookEndpointsInput = {}
  ): Promise<ListResponse<WebhookEndpoint>> {
    const query: Record<string, string | number | undefined> = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
    };

    return this.client.Get<ListResponse<WebhookEndpoint>>(
      '/webhook_endpoints',
      query
    );
  }
}
