import { BaseResource } from './Base';
import { ApplyDateFilter, type ListQuery } from '../utils';
import {
  IdentityVerificationSession,
  ListResponse,
} from '@zoneless/shared-types';
import type {
  CreateIdentityVerificationSessionInput,
  UpdateIdentityVerificationSessionInput,
  ListIdentityVerificationSessionsInput,
} from '../generated/Inputs';

/**
 * @see https://docs.zoneless.com/identity/verification_sessions
 */
export class IdentityVerificationSessions extends BaseResource {
  async create(
    params: CreateIdentityVerificationSessionInput
  ): Promise<IdentityVerificationSession> {
    return this.client.Post<IdentityVerificationSession>(
      '/identity/verification_sessions',
      params
    );
  }

  async retrieve(id: string): Promise<IdentityVerificationSession> {
    return this.client.Get<IdentityVerificationSession>(
      `/identity/verification_sessions/${id}`
    );
  }

  async update(
    id: string,
    params: UpdateIdentityVerificationSessionInput
  ): Promise<IdentityVerificationSession> {
    return this.client.Post<IdentityVerificationSession>(
      `/identity/verification_sessions/${id}`,
      params
    );
  }

  async cancel(id: string): Promise<IdentityVerificationSession> {
    return this.client.Post<IdentityVerificationSession>(
      `/identity/verification_sessions/${id}/cancel`
    );
  }

  async redact(id: string): Promise<IdentityVerificationSession> {
    return this.client.Post<IdentityVerificationSession>(
      `/identity/verification_sessions/${id}/redact`
    );
  }

  async list(
    params: ListIdentityVerificationSessionsInput = {}
  ): Promise<ListResponse<IdentityVerificationSession>> {
    const query: ListQuery = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      related_account: params.related_account,
      status: params.status,
    };
    ApplyDateFilter(query, 'created', params.created);
    return this.client.Get<ListResponse<IdentityVerificationSession>>(
      '/identity/verification_sessions',
      query
    );
  }
}
