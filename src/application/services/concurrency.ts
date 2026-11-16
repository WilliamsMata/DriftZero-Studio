/**
 * Runs an async mapper over a list with a fixed worker pool.
 *
 * Media providers enforce their own rate limits, so the pipeline uses this
 * helper instead of unbounded `Promise.all` fan-out. Results stay in input
 * order regardless of completion order.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  let failed = false;

  async function worker(): Promise<void> {
    for (;;) {
      if (failed) return;

      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) return;

      const item = items[currentIndex];

      if (item === undefined) return;

      try {
        results[currentIndex] = await mapper(item, currentIndex);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }

  const workerCount = Math.max(
    1,
    Math.min(Math.trunc(limit), items.length),
  );
  const settled = await Promise.allSettled(
    Array.from({ length: workerCount }, () => worker()),
  );

  for (const result of settled) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }

  return results;
}
