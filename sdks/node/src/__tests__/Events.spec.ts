import { Events } from '../resources/Events';
import { HttpClient } from '../HttpClient';

describe('Events', () => {
  const Get = jest.fn();
  const events = new Events({ Get } as unknown as HttpClient);

  beforeEach(() => {
    Get.mockClear();
  });

  it('sends related_object as a query parameter', async () => {
    Get.mockResolvedValue({ object: 'list', data: [], has_more: false });

    await events.list({ related_object: 'prod_z_123' });

    expect(Get).toHaveBeenCalledWith(
      '/events',
      expect.objectContaining({
        related_object: 'prod_z_123',
      })
    );
  });

  it('omits related_object when not provided', async () => {
    Get.mockResolvedValue({ object: 'list', data: [], has_more: false });

    await events.list({ limit: 3 });

    expect(Get).toHaveBeenCalledWith(
      '/events',
      expect.not.objectContaining({
        related_object: expect.anything(),
      })
    );
  });
});
