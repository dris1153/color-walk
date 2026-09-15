import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { createControl } from '../crawl-control.mjs';

const quiet = () => {};
/** Its own directory: a control made here must never write "pausing" into the
 *  real crawl.log or a heartbeat into the real progress.json. */
const SCRATCH = tmpdir();
const control = (opts: Record<string, unknown> = {}) => createControl({ log: quiet, dir: SCRATCH, ...opts });

describe('crawl control', () => {
  it('runs unbounded when no --minutes is given', () => {
    const c = control();
    expect(c.stopped).toBe(false);
    c.release();
  });

  it('stops once the time limit passes', async () => {
    const c = control({ minutes: 1 / 60_000 }); // 1ms
    try {
      expect(c.stopped).toBe(false);
      await new Promise((r) => setTimeout(r, 20));
      expect(c.stopped).toBe(true);
      expect(c.reason).toBe('reached the --minutes limit');
    } finally {
      // Always, or an orphaned SIGINT handler makes the next test exit the run.
      c.release();
    }
  });

  it('stops on SIGINT and says so', () => {
    const c = control();
    try {
      process.emit('SIGINT');
      expect(c.stopped).toBe(true);
      expect(c.reason).toBe('paused with Ctrl+C');
    } finally {
      c.release();
    }
  });

  it('cuts a long wait short once paused, so a cooldown cannot swallow a Ctrl+C', async () => {
    const c = control();
    try {
      const started = Date.now();
      const waiting = c.wait(90_000);
      process.emit('SIGINT');
      await waiting;
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      c.release();
    }
  });

  it('removes its handler on release, so a run cannot leave one behind', () => {
    const before = process.listenerCount('SIGINT');
    control().release();
    expect(process.listenerCount('SIGINT')).toBe(before);
  });
});
