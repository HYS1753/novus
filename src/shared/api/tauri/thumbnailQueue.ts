import { invoke } from "@tauri-apps/api/core";

interface ThumbnailJob {
  key: string;
  filePath: string;
  maxDim: number;
  priority: number;
  subscribers: number;
  started: boolean;
  promise: Promise<string>;
  resolve: (value: string) => void;
  reject: (error: unknown) => void;
}

const MAX_ACTIVE = 2;
const MAX_CACHED_CHARS = 12 * 1024 * 1024;
const pending: ThumbnailJob[] = [];
const jobs = new Map<string, ThumbnailJob>();
const cache = new Map<string, string>();
let cachedChars = 0;
let active = 0;

function remember(key: string, value: string) {
  if (value.length > MAX_CACHED_CHARS) return;
  cache.set(key, value);
  cachedChars += value.length;
  while (cachedChars > MAX_CACHED_CHARS) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) break;
    cachedChars -= cache.get(oldestKey)?.length ?? 0;
    cache.delete(oldestKey);
  }
}

function pump() {
  pending.sort((a, b) => b.priority - a.priority);
  while (active < MAX_ACTIVE && pending.length > 0) {
    const job = pending.shift();
    if (!job) break;
    if (job.subscribers === 0) {
      jobs.delete(job.key);
      job.reject(new DOMException("Thumbnail request cancelled", "AbortError"));
      continue;
    }
    job.started = true;
    active++;
    void invoke<string>("get_image_thumbnail", {
      filePath: job.filePath,
      maxDim: job.maxDim,
    })
      .then((value) => {
        remember(job.key, value);
        job.resolve(value);
      })
      .catch(job.reject)
      .finally(() => {
        jobs.delete(job.key);
        active--;
        pump();
      });
  }
}

export function queueThumbnail(
  filePath: string,
  maxDim: number,
  priority = 0,
  signal?: AbortSignal,
  version = "",
): Promise<string> {
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  const key = `${filePath}\u0000${maxDim}\u0000${version}`;
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return Promise.resolve(cached);
  }

  let job = jobs.get(key);
  if (!job) {
    let resolve!: (value: string) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    job = {
      key,
      filePath,
      maxDim,
      priority,
      subscribers: 0,
      started: false,
      promise,
      resolve,
      reject,
    };
    jobs.set(key, job);
    pending.push(job);
  }
  job.priority = Math.max(job.priority, priority);
  job.subscribers++;
  const subscribedJob = job;
  const result = new Promise<string>((resolve, reject) => {
    const onAbort = () => {
      subscribedJob.subscribers--;
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    subscribedJob.promise.then(
      (value) => {
        signal?.removeEventListener("abort", onAbort);
        if (!signal?.aborted) resolve(value);
      },
      (error) => {
        signal?.removeEventListener("abort", onAbort);
        if (!signal?.aborted) reject(error);
      },
    );
  });
  pump();
  return result;
}
