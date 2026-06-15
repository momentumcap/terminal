import pLimit from "p-limit";

const limiters = new Map<string, ReturnType<typeof pLimit>>();
const failures = new Map<string, { count: number; openedUntil: number }>();

export function providerLimit(provider: string, concurrency = 3) {
  if (!limiters.has(provider)) limiters.set(provider, pLimit(concurrency));
  return limiters.get(provider)!;
}

export async function withProviderGuard<T>(provider: string, task: () => Promise<T>, options: { retries?: number; timeoutMs?: number; concurrency?: number } = {}): Promise<T> {
  const state = failures.get(provider);
  if (state && state.openedUntil > Date.now()) throw new Error(`${provider} circuit open`);
  const run = providerLimit(provider, options.concurrency ?? 3);
  return run(() => retryWithTimeout(provider, task, options.retries ?? 2, options.timeoutMs ?? 12_000));
}

async function retryWithTimeout<T>(provider: string, task: () => Promise<T>, retries: number, timeoutMs: number): Promise<T> {
  try {
    const value = await Promise.race([
      task(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${provider} timeout`)), timeoutMs))
    ]);
    failures.delete(provider);
    return value;
  } catch (error) {
    if (retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (3 - retries)));
      return retryWithTimeout(provider, task, retries - 1, timeoutMs);
    }
    const state = failures.get(provider) ?? { count: 0, openedUntil: 0 };
    state.count += 1;
    if (state.count >= 4) state.openedUntil = Date.now() + 30_000;
    failures.set(provider, state);
    throw error;
  }
}
