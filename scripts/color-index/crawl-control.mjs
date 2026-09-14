import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './download-thumbnails.mjs';

export const PROGRESS_PATH = path.join(CACHE_DIR, 'progress.json');
/** A crawl runs at 1.25 items/s; the progress file must not chase it. */
const WRITE_EVERY_MS = 1000;

/**
 * Pause and time limit, shared by every long stage. SIGINT only sets a flag:
 * the stage stops at its next item boundary, so the cache is never left
 * mid-record. A second SIGINT is the escape hatch for a hung request.
 */
export function createControl({ minutes = 0, command = '', log = console.log } = {}) {
  const startedAt = Date.now();
  const deadline = minutes > 0 ? startedAt + minutes * 60_000 : Infinity;
  let paused = false;
  let lastWrite = 0;
  let stageStartedAt = startedAt;
  let state = { stage: 'starting', done: 0, total: 0 };

  const onSigint = () => {
    if (paused) process.exit(130);
    paused = true;
    log('\npause requested - finishing the item in flight. Ctrl+C again to exit now.');
  };
  process.on('SIGINT', onSigint);

  const write = async (extra = {}) => {
    const stageSeconds = (Date.now() - stageStartedAt) / 1000;
    const perMinute = stageSeconds > 0 ? +(state.done / (stageSeconds / 60)).toFixed(1) : 0;
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(
      PROGRESS_PATH,
      JSON.stringify(
        {
          ...state,
          command,
          perMinute,
          minutesLeft:
            perMinute > 0 && state.total > state.done
              ? Math.round((state.total - state.done) / perMinute)
              : null,
          startedAt: new Date(startedAt).toISOString(),
          updatedAt: new Date().toISOString(),
          // Last, so a finishing run can retract a rate that no longer means
          // anything now that the stage it was measured over has ended.
          ...extra,
        },
        null,
        2,
      ),
    );
  };

  return {
    get stopped() {
      return paused || Date.now() >= deadline;
    },
    get reason() {
      return paused ? 'paused with Ctrl+C' : 'reached the --minutes limit';
    },
    async progress(next) {
      if (next.stage && next.stage !== state.stage) stageStartedAt = Date.now();
      state = { ...state, ...next };
      if (Date.now() - lastWrite < WRITE_EVERY_MS) return;
      lastWrite = Date.now();
      await write();
    },
    /** Interruptible sleep, so a 90s WAF cooldown does not swallow a Ctrl+C. */
    async wait(ms) {
      const until = Date.now() + ms;
      while (Date.now() < until && !paused) {
        await new Promise((r) => setTimeout(r, Math.min(500, until - Date.now())));
      }
    },
    finish: (extra) => write(extra),
    release: () => process.off('SIGINT', onSigint),
  };
}
