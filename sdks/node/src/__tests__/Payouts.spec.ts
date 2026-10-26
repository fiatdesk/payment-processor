// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { Payouts } from '../resources/Payouts';
import { HttpClient } from '../HttpClient';

describe('Payouts Resource', () => {
  const Get = jest.fn();
  const Post = jest.fn();
  const payouts = new Payouts({ Get, Post } as unknown as HttpClient);

  beforeEach(() => {
    Get.mockReset();
    Post.mockReset();
  });

  describe('processBatch', () => {
    it('should broadcast only the signed transaction and payout ids', async () => {
      const pending = [{ id: 'po_z_1' }, { id: 'po_z_2' }];
      Get.mockResolvedValue({
        object: 'list',
        data: pending,
        has_more: false,
      });
      Post.mockImplementation(async (path: string) => {
        if (path === '/payouts/build') {
          return {
            object: 'payout_batch_build',
            unsigned_transaction: 'sim_tx',
            estimated_fee: '0',
            fee_currency: 'none',
            chain_id: null,
            nonce: null,
            to: null,
            transaction_type: 'payout',
            batch_id: null,
            payouts: pending,
            total_amount: 1500,
            recipients_count: 2,
          };
        }
        return {
          object: 'payout_batch_broadcast',
          transaction_hash: 'tx_hash_1',
          status: 'paid',
          viewer_url: '',
          payouts: pending,
        };
      });

      const result = await payouts.processBatch('unused_secret');

      expect(Post).toHaveBeenCalledWith(
        '/payouts/build',
        { payouts: ['po_z_1', 'po_z_2'] },
        undefined
      );
      const broadcastCall = Post.mock.calls.find(
        ([path]) => path === '/payouts/broadcast'
      );
      // Strict: keys present with undefined values must fail too.
      expect(broadcastCall?.[1]).toStrictEqual({
        signed_transaction: 'sim_tx',
        payouts: ['po_z_1', 'po_z_2'],
      });
      expect(result).toEqual({
        transaction_hash: 'tx_hash_1',
        status: 'paid',
        viewer_url: '',
        payouts: pending,
        total_amount: 1500,
        has_more: false,
        failure_message: undefined,
      });
      expect(result).not.toHaveProperty('signature');
    });

    it('should return an empty transaction_hash when nothing is pending', async () => {
      Get.mockResolvedValue({
        object: 'list',
        data: [],
        has_more: false,
      });

      const result = await payouts.processBatch('unused_secret');

      expect(Post).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        transaction_hash: '',
        status: 'paid',
        payouts: [],
        has_more: false,
      });
    });
  });
});
