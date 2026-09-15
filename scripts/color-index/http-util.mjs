const USER_AGENT = 'ColorWalk-index/0.1 (build script)';
const BACKOFF_MS = [1000, 2000, 4000, 8000];
/**
 * No request may wait forever. Measured 2026-09-15: the Met's WAF drops SYNs
 * outright when it throttles, and a fetch with no deadline sat in SYN_SENT for
 * an hour, holding a worker and the whole run with it. A timed-out request is
 * a transient failure like a 5xx: retried, then given up on.
 */
export const JSON_TIMEOUT_MS = 30_000;
export const IMAGE_TIMEOUT_MS = 60_000;

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bounded-concurrency map. Results keep input order; rejections propagate. */
export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  const width = Math.max(1, Math.min(n, items.length));
  await Promise.all(
    Array.from({ length: width }, async () => {
      for (let i = next++; i < items.length; i = next++) {
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

function backoffFor(attempt) {
  const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
  return base + Math.floor(Math.random() * 400);
}

// 429 and 5xx are transient; 4xx otherwise means the resource is simply gone.
const isRetryableStatus = (s) => s === 429 || s === 408 || s >= 500;

/** The caller pulled the plug (pause, deadline): not a failure, not retried. */
export const isAbort = (err) => err?.name === 'AbortError';
/** The network went quiet past the deadline: retried, like a 5xx. */
const isTimeout = (err) => err?.name === 'TimeoutError';

function signalFor(timeoutMs, outer) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return outer ? AbortSignal.any([timeout, outer]) : timeout;
}

async function request(url, init, { retries, timeoutMs, signal }) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffFor(attempt - 1));
    if (signal?.aborted) throw signal.reason ?? new DOMException('aborted', 'AbortError');
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...(init?.headers ?? {}) },
        signal: signalFor(timeoutMs, signal),
      });
      if (res.ok) return res;
      if (!isRetryableStatus(res.status)) {
        const err = new Error(`http ${res.status} ${url}`);
        err.status = res.status;
        throw err;
      }
      lastError = new Error(`http ${res.status} ${url}`);
      lastError.status = res.status;
    } catch (err) {
      if (isAbort(err) && signal?.aborted) throw err; // ours, not a timeout
      if (err?.status && !isRetryableStatus(err.status)) throw err;
      lastError = isTimeout(err) ? new Error(`timeout after ${timeoutMs}ms ${url}`) : err;
    }
  }
  throw lastError ?? new Error(`request failed ${url}`);
}

/**
 * @typedef {{ retries?: number, signal?: AbortSignal, timeoutMs?: number }} RequestOptions
 * `timeoutMs` is overridable only so a test can prove the deadline without waiting for it.
 */

/** @param {string} url @param {RequestOptions} [options] */
export async function getJson(url, { retries = 4, signal, timeoutMs = JSON_TIMEOUT_MS } = {}) {
  const res = await request(url, { headers: { Accept: 'application/json' } }, { retries, timeoutMs, signal });
  return res.json();
}

/** @param {string} url @param {RequestOptions} [options] */
export async function getBuffer(url, { retries = 4, signal, timeoutMs = IMAGE_TIMEOUT_MS } = {}) {
  const res = await request(url, {}, { retries, timeoutMs, signal });
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Content-Length in bytes, or null when the server does not report one.
 * @param {string} url @param {RequestOptions} [options]
 */
export async function head(url, { retries = 2, signal, timeoutMs = JSON_TIMEOUT_MS } = {}) {
  try {
    const res = await request(url, { method: 'HEAD' }, { retries, timeoutMs, signal });
    const len = Number(res.headers.get('content-length'));
    return Number.isFinite(len) && len > 0 ? len : null;
  } catch (err) {
    if (isAbort(err)) throw err; // a pause must not be mistaken for "no length"
    return null;
  }
}
