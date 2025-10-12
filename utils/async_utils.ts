// 简单的并发受控执行器

export interface ConcurrencyOptions {
  concurrency?: number; // 并发限制, 缺省无限制
}

type MaybePromise<T> = T | Promise<T>;

// 内部：运行一个带并发限制的任务集合
async function runWithLimit<I, O>(
  items: I[],
  limit: number | undefined,
  fn: (item: I, index: number) => MaybePromise<O>,
): Promise<O[]> {
  if (!limit || limit <= 0 || limit === Infinity) {
    return Promise.all(items.map(fn));
  }

  const results: O[] = new Array(items.length) as O[];
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) return;
      results[current] = await fn(items[current], current);
    }
  }

  const workers = Array(Math.min(limit, items.length)).fill(0).map(() => worker());
  await Promise.all(workers);
  return results;
}


export class AsyncChain<T> implements AsyncIterable<T> {
  private readonly _iterable: AsyncIterable<T>;
  private readonly _concurrency?: number;

  private constructor(iterable: AsyncIterable<T>, concurrency?: number) {
    this._iterable = iterable;
    this._concurrency = concurrency;
  }

  static from<T>(src: Iterable<T> | AsyncIterable<T>): AsyncChain<T> {
    if (isAsyncIterable(src)) return new AsyncChain(src);
    return new AsyncChain(toAsyncIterable(src));
  }

  static of<T>(...values: T[]): AsyncChain<T> {
    return AsyncChain.from(values);
  }

  parallel(concurrency: number | undefined): AsyncChain<T> {
    return new AsyncChain(this._iterable, concurrency);
  }

  map<U>(fn: (value: T, index: number) => MaybePromise<U>): AsyncChain<U> {
    async function* gen() {
      // 收集后再并发映射以保持次序
      const arr = await (await thisRef).toArray();
      const mapped = await runWithLimit(arr, (await thisRef)._concurrency, fn);
      for (const m of mapped) yield m;
    }
    const thisRef = Promise.resolve(this as AsyncChain<T>);
    return new AsyncChain<U>(gen.call(undefined), this._concurrency);
  }

  filter(fn: (value: T, index: number) => MaybePromise<boolean>): AsyncChain<T> {
    async function* gen() {
      const arr = await (await thisRef).toArray();
      const flags = await runWithLimit(arr, (await thisRef)._concurrency, fn);
      for (let i = 0; i < arr.length; i++) {
        if (flags[i]) yield arr[i];
      }
    }
    const thisRef = Promise.resolve(this as AsyncChain<T>);
    return new AsyncChain<T>(gen.call(undefined), this._concurrency);
  }

  flatMap<U>(fn: (value: T, index: number) => MaybePromise<Iterable<U> | AsyncIterable<U>>): AsyncChain<U> {
    async function* gen() {
      const arr = await (await thisRef).toArray();
      const mapped = await runWithLimit(arr, (await thisRef)._concurrency, fn);
      for (const part of mapped) {
        for await (const inner of toAsyncIterable(part)) {
          yield inner as U;
        }
      }
    }
    const thisRef = Promise.resolve(this as AsyncChain<T>);
    return new AsyncChain<U>(gen.call(undefined), this._concurrency);
  }

  tap(fn: (value: T, index: number) => MaybePromise<void>): AsyncChain<T> {
    async function* gen() {
      let idx = 0;
      for await (const v of (await thisRef)._iterable) {
        await fn(v, idx++);
        yield v;
      }
    }
    const thisRef = Promise.resolve(this as AsyncChain<T>);
    return new AsyncChain<T>(gen.call(undefined), this._concurrency);
  }

  take(n: number): AsyncChain<T> {
    async function* gen() {
      if (n <= 0) return;
      let count = 0;
      for await (const v of (await thisRef)._iterable) {
        yield v;
        if (++count >= n) break;
      }
    }
    const thisRef = Promise.resolve(this as AsyncChain<T>);
    return new AsyncChain<T>(gen.call(undefined), this._concurrency);
  }

  skip(n: number): AsyncChain<T> {
    async function* gen() {
      let skipped = 0;
      for await (const v of (await thisRef)._iterable) {
        if (skipped < n) {
          skipped++;
          continue;
        }
        yield v;
      }
    }
    const thisRef = Promise.resolve(this as AsyncChain<T>);
    return new AsyncChain<T>(gen.call(undefined), this._concurrency);
  }

  async reduce<U>(reducer: (acc: U, value: T, index: number) => MaybePromise<U>, initial: U): Promise<U> {
    let acc = initial;
    let i = 0;
    for await (const v of this._iterable) {
      acc = await reducer(acc, v, i++);
    }
    return acc;
  }

  async forEach(fn: (value: T, index: number) => MaybePromise<void>): Promise<void> {
    let i = 0;
    for await (const v of this._iterable) {
      await fn(v, i++);
    }
  }

  async toArray(): Promise<T[]> {
    if (Array.isArray(this._iterable)) return this._iterable as unknown as T[];
    const out: T[] = [];
    for await (const v of this._iterable) out.push(v);
    return out;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this._iterable[Symbol.asyncIterator]();
  }
}

function isAsyncIterable<T>(obj: unknown): obj is AsyncIterable<T> {
  if (!obj) return false;
  const maybe = obj as { [Symbol.asyncIterator]?: unknown };
  return typeof maybe[Symbol.asyncIterator] === "function";
}

async function* toAsyncIterable<T>(src: Iterable<T> | AsyncIterable<T>) {
  if (isAsyncIterable<T>(src)) {
    for await (const v of src) yield v;
  } else {
    for (const v of src) yield v;
  }
}

