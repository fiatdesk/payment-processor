// Modified from the Zoneless project (Apache-2.0). See NOTICE and CHANGES.md.
/**
 * In-process mutual exclusion by key: tasks for the same key run one at a
 * time, in call order; tasks for different keys run concurrently. A failed
 * task does not block the next one. It does not coordinate across processes.
 *
 * @module utils/KeyedLock
 */

const tails = new Map<string, Promise<void>>();

export async function WithKeyedLock<T>(
  key: string,
  task: () => Promise<T>
): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(task);
  const tail = run.then(
    () => undefined,
    () => undefined
  );
  tails.set(key, tail);
  try {
    return await run;
  } finally {
    if (tails.get(key) === tail) tails.delete(key);
  }
}
