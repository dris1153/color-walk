import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { getJson, head, isAbort } from '../http-util.mjs';

/**
 * A server that behaves like the Met's WAF on a bad day: some paths answer,
 * some answer badly, and one never answers at all.
 */
let server: Server;
let base: string;
let hits: Record<string, number>;

beforeAll(async () => {
  hits = {};
  server = createServer((req, res) => {
    const path = req.url ?? '/';
    hits[path] = (hits[path] ?? 0) + 1;
    if (path === '/hang') return; // the socket stays open and silent, forever
    if (path === '/flaky') {
      if (hits[path] < 3) {
        res.writeHead(503).end();
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}');
      return;
    }
    if (path === '/gone') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': '11' }).end('{"ok":true}');
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const address = server.address();
  base = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(() => {
  server.closeAllConnections?.();
  server.close();
});

describe('a request that never answers', () => {
  it('gives up after the deadline, tries again, then fails with a timeout - it does not hang', async () => {
    const started = Date.now();
    await expect(getJson(`${base}/hang`, { retries: 1, timeoutMs: 150 })).rejects.toThrow(/timeout after 150ms/);
    const elapsed = Date.now() - started;
    expect(hits['/hang']).toBe(2); // the first try and one retry
    expect(elapsed).toBeLessThan(5000); // two deadlines plus one backoff, not forever
  });
});

describe('a request the caller pulls the plug on', () => {
  it('stops at once, is not retried, and says it was aborted rather than that it timed out', async () => {
    const controller = new AbortController();
    const pending = getJson(`${base}/hang`, { retries: 3, timeoutMs: 10_000, signal: controller.signal });
    setTimeout(() => controller.abort(new DOMException('paused', 'AbortError')), 50);
    const started = Date.now();
    await expect(pending).rejects.toSatisfy((err: unknown) => isAbort(err));
    expect(Date.now() - started).toBeLessThan(2000);
    expect(hits['/hang']).toBe(3); // the two from the test above, plus this one
  });

  it('does not even start when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const before = hits['/ok'] ?? 0;
    await expect(getJson(`${base}/ok`, { signal: controller.signal })).rejects.toSatisfy((err: unknown) => isAbort(err));
    expect(hits['/ok'] ?? 0).toBe(before);
  });

  it('is surfaced by head() too, rather than read as "no content length"', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(head(`${base}/ok`, { signal: controller.signal })).rejects.toSatisfy((err: unknown) => isAbort(err));
  });
});

describe('ordinary failures are unchanged', () => {
  it('retries a 503 and succeeds when the server recovers', async () => {
    await expect(getJson(`${base}/flaky`, { retries: 4 })).resolves.toEqual({ ok: true });
    expect(hits['/flaky']).toBe(3);
  });

  it('does not retry a 404', async () => {
    await expect(getJson(`${base}/gone`, { retries: 4 })).rejects.toThrow(/http 404/);
    expect(hits['/gone']).toBe(1);
  });

  it('reads a content length', async () => {
    await expect(head(`${base}/ok`)).resolves.toBe(11);
  });
});
