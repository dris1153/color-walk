const USER_AGENT = 'ColorWalk-index/0.1 (build script)';
const BACKOFF_MS = [1000, 2000, 4000, 8000];

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

async function request(url, init, retries) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(backoffFor(attempt - 1));
    try {
      const res = await fetch(url, {
        ...init,
        headers: { 'User-Agent': USER_AGENT, ...(init?.headers ?? {}) },
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
      if (err?.status && !isRetryableStatus(err.status)) throw err;
      lastError = err;
    }
  }
  throw lastError ?? new Error(`request failed ${url}`);
}

export async function getJson(url, { retries = 4 } = {}) {
  const res = await request(url, { headers: { Accept: 'application/json' } }, retries);
  return res.json();
}

export async function getBuffer(url, { retries = 4 } = {}) {
  const res = await request(url, {}, retries);
  return Buffer.from(await res.arrayBuffer());
}

/** Content-Length in bytes, or null when the server does not report one. */
export async function head(url, { retries = 2 } = {}) {
  try {
    const res = await request(url, { method: 'HEAD' }, retries);
    const len = Number(res.headers.get('content-length'));
    return Number.isFinite(len) && len > 0 ? len : null;
  } catch {
    return null;
  }
}
