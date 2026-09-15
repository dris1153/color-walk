import { afterEach, describe, expect, it } from 'vitest';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acquireLock, createControl, isAlive } from '../crawl-control.mjs';

const quiet = () => {};
/** A lock of its own: the real one may belong to a crawl running right now,
 *  and a test must never take that away from it. */
const LOCK = path.join(tmpdir(), `color-walk-lock-test-${process.pid}`);
const SCRATCH = tmpdir();
const clearLock = () => unlink(LOCK).catch(() => {});

afterEach(clearLock);

describe('the lock', () => {
  it('is taken by the first crawl and refused to a second, naming the first', async () => {
    const release = await acquireLock(LOCK);
    expect(await readFile(LOCK, 'utf8')).toBe(String(process.pid));
    // A different live pid holds it: refused, and told who.
    await writeFile(LOCK, String(process.ppid));
    await expect(acquireLock(LOCK)).rejects.toThrow(new RegExp(`another crawl is running \\(pid ${process.ppid}\\)`));
    await release();
  });

  it('is taken over when its owner is dead', async () => {
    // No process has this pid on any sane machine.
    await writeFile(LOCK, '2147483647');
    const release = await acquireLock(LOCK);
    expect(await readFile(LOCK, 'utf8')).toBe(String(process.pid));
    await release();
  });

  it('is removed on release', async () => {
    const release = await acquireLock(LOCK);
    await release();
    await expect(readFile(LOCK, 'utf8')).rejects.toThrow();
  });

  it('knows a live process from a dead one', () => {
    expect(isAlive(process.pid)).toBe(true);
    expect(isAlive(2147483647)).toBe(false);
  });
});

describe('pausing aborts what is in flight', () => {
  it('turns Ctrl+C into an aborted signal, so a hung request cannot hold the run', () => {
    const control = createControl({ log: quiet, dir: SCRATCH });
    try {
      expect(control.signal.aborted).toBe(false);
      process.emit('SIGINT');
      expect(control.signal.aborted).toBe(true);
      expect(control.stopped).toBe(true);
      expect(control.reason).toBe('paused with Ctrl+C');
    } finally {
      control.release();
    }
  });

  it('cuts a long wait short once aborted', async () => {
    const control = createControl({ log: quiet, dir: SCRATCH });
    try {
      const started = Date.now();
      const waiting = control.wait(60_000);
      process.emit('SIGINT');
      await waiting;
      expect(Date.now() - started).toBeLessThan(2000);
    } finally {
      control.release();
    }
  });

  it('counts requests in flight through track()', async () => {
    const control = createControl({ log: quiet, dir: SCRATCH });
    try {
      let resolve: (v: number) => void = () => {};
      const slow = new Promise<number>((r) => (resolve = r));
      const tracked = control.track(slow);
      resolve(7);
      await expect(tracked).resolves.toBe(7);
    } finally {
      control.release();
    }
  });

  it('leaves no SIGINT handler behind on release', () => {
    const before = process.listenerCount('SIGINT');
    createControl({ log: quiet, dir: SCRATCH }).release();
    expect(process.listenerCount('SIGINT')).toBe(before);
  });
});
