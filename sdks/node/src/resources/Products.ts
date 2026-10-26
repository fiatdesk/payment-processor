import { BaseResource } from './Base';
import { ApplyDateFilter, type ListQuery } from '../utils';
import { Product, ProductDeleted, ListResponse } from '@zoneless/shared-types';
import type {
  RetrieveProductInput,
  CreateProductInput,
  UpdateProductInput,
  ListProductsInput,
} from '../generated/Inputs';

/**
 * @see https://docs.zoneless.com/products
 */
export class Products extends BaseResource {
  /** @see https://docs.zoneless.com/products/create */
  async create(params: CreateProductInput): Promise<Product> {
    return this.client.Post<Product>('/products', params);
  }

  /** @see https://docs.zoneless.com/products/update */
  async update(id: string, params: UpdateProductInput): Promise<Product> {
    return this.client.Post<Product>(`/products/${id}`, params);
  }

  /** @see https://docs.zoneless.com/products/retrieve */
  async retrieve(
    id: string,
    params: RetrieveProductInput = {}
  ): Promise<Product> {
    return this.client.Get<Product>(`/products/${id}`, params);
  }

  /** @see https://docs.zoneless.com/products/delete */
  async del(id: string): Promise<ProductDeleted> {
    return this.client.Delete<ProductDeleted>(`/products/${id}`);
  }

  /** @see https://docs.zoneless.com/products/list */
  async list(params: ListProductsInput = {}): Promise<ListResponse<Product>> {
    const query: ListQuery = {
      limit: params.limit,
      starting_after: params.starting_after,
      ending_before: params.ending_before,
      active: params.active,
      shippable: params.shippable,
      ids: params.ids,
      url: params.url,
    };
    ApplyDateFilter(query, 'created', params.created);
    return this.client.Get<ListResponse<Product>>(`/products`, query);
  }
}
