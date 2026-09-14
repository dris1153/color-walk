import { describe, expect, it } from 'vitest';
import { createControl } from '../crawl-control.mjs';

const quiet = () => {};

describe('crawl control', () => {
  it('runs unbounded when no --minutes is given', () => {
    const control = createControl({ log: quiet });
    expect(control.stopped).toBe(false);
    control.release();
  });

  it('stops once the time limit passes', async () => {
    const control = createControl({ minutes: 1 / 60_000, log: quiet }); // 1ms
    try {
      expect(control.stopped).toBe(false);
      await new Promise((r) => setTimeout(r, 20));
      expect(control.stopped).toBe(true);
      expect(control.reason).toBe('reached the --minutes limit');
    } finally {
      // Always, or an orphaned SIGINT handler makes the next test exit the run.
      control.release();
    }
  });

  it('stops on SIGINT and says so', async () => {
    const control = createControl({ log: quiet });
    process.emit('SIGINT');
    expect(control.stopped).toBe(true);
    expect(control.reason).toBe('paused with Ctrl+C');
    control.release();
  });

  it('cuts a long wait short once paused, so a cooldown cannot swallow a Ctrl+C', async () => {
    const control = createControl({ log: quiet });
    const started = Date.now();
    const waiting = control.wait(90_000);
    process.emit('SIGINT');
    await waiting;
    expect(Date.now() - started).toBeLessThan(2000);
    control.release();
  });

  it('removes its handler on release, so a run cannot leave one behind', () => {
    const before = process.listenerCount('SIGINT');
    createControl({ log: quiet }).release();
    expect(process.listenerCount('SIGINT')).toBe(before);
  });
});
