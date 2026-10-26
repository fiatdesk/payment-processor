import { SubscriptionItems } from '../resources/SubscriptionItems';
import { HttpClient } from '../HttpClient';

describe('SubscriptionItems Resource', () => {
  let client: jest.Mocked<HttpClient>;
  let subscriptionItems: SubscriptionItems;

  beforeEach(() => {
    client = {
      Get: jest.fn(),
      Post: jest.fn(),
      Delete: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;
    subscriptionItems = new SubscriptionItems(client);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should send a POST request to /subscription_items with params', async () => {
      const params = {
        subscription: 'sub_123',
        price: 'price_123',
        quantity: 2,
      };

      await subscriptionItems.create(params);

      expect(client.Post).toHaveBeenCalledWith('/subscription_items', params);
    });
  });

  describe('update', () => {
    it('should send a POST request to /subscription_items/:id with params', async () => {
      const params = {
        quantity: 3,
      };

      await subscriptionItems.update('si_123', params);

      expect(client.Post).toHaveBeenCalledWith(
        '/subscription_items/si_123',
        params
      );
    });
  });

  describe('retrieve', () => {
    it('should send a GET request to /subscription_items/:id', async () => {
      await subscriptionItems.retrieve('si_123');

      expect(client.Get).toHaveBeenCalledWith('/subscription_items/si_123', {});
    });

    it('should pass expand params if provided', async () => {
      await subscriptionItems.retrieve('si_123', { expand: ['price'] });

      expect(client.Get).toHaveBeenCalledWith('/subscription_items/si_123', {
        expand: ['price'],
      });
    });
  });

  describe('list', () => {
    it('should send a GET request to /subscription_items with query params', async () => {
      await subscriptionItems.list({
        subscription: 'sub_123',
        limit: 5,
        starting_after: 'si_456',
      });

      expect(client.Get).toHaveBeenCalledWith('/subscription_items', {
        subscription: 'sub_123',
        limit: 5,
        starting_after: 'si_456',
        ending_before: undefined,
      });
    });
  });

  describe('del', () => {
    it('should send a DELETE request to /subscription_items/:id', async () => {
      await subscriptionItems.del('si_123');

      expect(client.Delete).toHaveBeenCalledWith(
        '/subscription_items/si_123',
        {}
      );
    });

    it('should send optional proration params if provided', async () => {
      await subscriptionItems.del('si_123', { clear_usage: true });

      expect(client.Delete).toHaveBeenCalledWith('/subscription_items/si_123', {
        clear_usage: true,
      });
    });
  });
});
