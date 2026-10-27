// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
import { WithKeyedLock } from '../utils/KeyedLock';

function Deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('WithKeyedLock', () => {
  it('runs tasks for one key one at a time, in call order', async () => {
    const order: string[] = [];
    const gate = Deferred();

    const first = WithKeyedLock('relayer', async () => {
      order.push('first:start');
      await gate.promise;
      order.push('first:end');
    });
    const second = WithKeyedLock('relayer', async () => {
      order.push('second');
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual(['first:start']);

    gate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(['first:start', 'first:end', 'second']);
  });

  it('runs tasks for different keys concurrently', async () => {
    const gate = Deferred();
    const blocked = WithKeyedLock('a', () => gate.promise);

    await expect(WithKeyedLock('b', async () => 'b ran')).resolves.toBe(
      'b ran'
    );
    gate.resolve();
    await blocked;
  });

  it('runs the next task after one fails and passes each result through', async () => {
    const failed = WithKeyedLock('key', async () => {
      throw new Error('boom');
    });
    const next = WithKeyedLock('key', async () => 42);

    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe(42);
  });
});
