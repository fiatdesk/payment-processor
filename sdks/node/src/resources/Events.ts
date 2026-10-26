import { BaseResource } from './Base';
import { ApplyDateFilter } from '../utils';
import { Event, ListResponse } from '@zoneless/shared-types';
import type { ListEventsInput } from '../generated/Inputs';

/**
 * @see https://docs.zoneless.com/events
 */
export class Events extends BaseResource {
  /** @see https://docs.zoneless.com/events/retrieve */
  async retrieve(id: string): Promise<Event> {
    return this.client.Get<Event>(`/events/${id}`);
  }

  /** @see https://docs.zoneless.com/events/list */
  async list(params: ListEventsInput = {}): Promise<ListResponse<Event>> {
    const query = this.BuildQuery(params);
    return this.client.Get<ListResponse<Event>>('/events', query);
  }

  private BuildQuery(
    params: ListEventsInput
  ): Record<string, string | number | undefined> {
    const query: Record<string, string | number | undefined> = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      related_object: params.related_object,
      type: params.type,
    };

    // Expand types array to indexed format: types[0], types[1], etc.
    if (params.types) {
      params.types.forEach((eventType, index) => {
        query[`types[${index}]`] = eventType;
      });
    }

    ApplyDateFilter(query, 'created', params.created);

    return query;
  }
}
