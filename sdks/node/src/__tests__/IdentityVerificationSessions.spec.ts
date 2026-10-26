import { IdentityVerificationSessions } from '../resources/IdentityVerificationSessions';
import { HttpClient } from '../HttpClient';

describe('IdentityVerificationSessions', () => {
  const Get = jest.fn();
  const Post = jest.fn();
  const sessions = new IdentityVerificationSessions({
    Get,
    Post,
  } as unknown as HttpClient);

  beforeEach(() => {
    Get.mockClear();
    Post.mockClear();
    Get.mockResolvedValue({ id: 'vs_z_123' });
    Post.mockResolvedValue({ id: 'vs_z_123' });
  });

  it('creates a session at the collection path', async () => {
    await sessions.create({ type: 'document', related_account: 'acct_z_123' });

    expect(Post).toHaveBeenCalledWith('/identity/verification_sessions', {
      type: 'document',
      related_account: 'acct_z_123',
    });
  });

  it('retrieves a session by id', async () => {
    await sessions.retrieve('vs_z_123');

    expect(Get).toHaveBeenCalledWith(
      '/identity/verification_sessions/vs_z_123'
    );
  });

  it('updates a session by id', async () => {
    await sessions.update('vs_z_123', { metadata: { order: '42' } });

    expect(Post).toHaveBeenCalledWith(
      '/identity/verification_sessions/vs_z_123',
      { metadata: { order: '42' } }
    );
  });

  it('cancels and redacts a session', async () => {
    await sessions.cancel('vs_z_123');
    await sessions.redact('vs_z_123');

    expect(Post).toHaveBeenNthCalledWith(
      1,
      '/identity/verification_sessions/vs_z_123/cancel'
    );
    expect(Post).toHaveBeenNthCalledWith(
      2,
      '/identity/verification_sessions/vs_z_123/redact'
    );
  });

  it('maps list filters onto query parameters', async () => {
    Get.mockResolvedValue({ object: 'list', data: [], has_more: false });

    await sessions.list({
      limit: 3,
      status: 'requires_input',
      related_account: 'acct_z_123',
      created: { gte: 1700000000 },
    });

    expect(Get).toHaveBeenCalledWith('/identity/verification_sessions', {
      limit: 3,
      starting_after: undefined,
      ending_before: undefined,
      related_account: 'acct_z_123',
      status: 'requires_input',
      'created[gte]': 1700000000,
    });
  });
});
