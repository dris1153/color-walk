import { appendFile, mkdir, readFile, stat, truncate, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CACHE_DIR } from './download-thumbnails.mjs';

export const PROGRESS_PATH = path.join(CACHE_DIR, 'progress.json');
export const LOCK_PATH = path.join(CACHE_DIR, 'crawl.lock');
export const LOG_PATH = path.join(CACHE_DIR, 'crawl.log');
/** Written on a timer, not only when an item lands: a stalled stage must still
 *  announce itself, and status must be able to tell stalled from slow. */
export const HEARTBEAT_MS = 5_000;
/** The log survives the terminal; it does not need to survive forever. */
const LOG_KEEP_BYTES = 5 * 1024 * 1024;

/** Whether the process that wrote a lock is still alive. */
export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === 'EPERM'; // alive, just not ours
  }
}

/**
 * Two crawls at once append safely but race on progress.json and public/index,
 * and it happened twice. The lock names its owner so the refusal can too, and a
 * lock whose owner is dead is simply taken over.
 */
export async function acquireLock(lockPath = LOCK_PATH) {
  await mkdir(path.dirname(lockPath), { recursive: true });
  const held = await readFile(lockPath, 'utf8').catch(() => null);
  const pid = Number(held);
  if (held && Number.isInteger(pid) && pid !== process.pid && isAlive(pid)) {
    throw new Error(`another crawl is running (pid ${pid}); wait for it, or stop it first`);
  }
  await writeFile(lockPath, String(process.pid));
  return () => unlink(lockPath).catch(() => {});
}

async function trimLog(logPath) {
  try {
    const { size } = await stat(logPath);
    if (size > LOG_KEEP_BYTES) await truncate(logPath, 0); // ponytail: drop, don't rotate
  } catch {
    /* no log yet */
  }
}

/**
 * Pause, time limit, heartbeat and log, shared by every long stage. A pause or
 * an expired limit aborts every request in flight through `signal`, so the run
 * drains in milliseconds rather than waiting on a socket the network has
 * forgotten; the append-only cache makes retrying that item next time free.
 */
export function createControl({ minutes = 0, command = '', log = console.log, dir = CACHE_DIR } = {}) {
  // `dir` exists for tests: a control made in a test once wrote "pausing" into
  // the real crawl.log while a real crawl was running, and it took an hour to
  // work out that the crawl had never been paused at all.
  const progressPath = path.join(dir, 'progress.json');
  const logPath = path.join(dir, 'crawl.log');
  const startedAt = Date.now();
  const deadline = minutes > 0 ? startedAt + minutes * 60_000 : Infinity;
  const aborter = new AbortController();
  let paused = false;
  let stageStartedAt = startedAt;
  let state = { stage: 'starting', done: 0, total: 0, network: 0 };
  let inflight = 0;
  let lastAdvance = startedAt;

  const tee = (line) => {
    log(line);
    appendFile(logPath, `${new Date().toISOString()} ${line}\n`).catch(() => {});
  };
  const stop = (why) => {
    if (aborter.signal.aborted) return;
    aborter.abort(new DOMException(why, 'AbortError'));
  };
  const onSigint = () => {
    paused = true;
    tee('pausing: requests in flight are dropped and retried next run');
    stop('paused');
  };
  process.on('SIGINT', onSigint);

  const write = async (extra = {}) => {
    const stageSeconds = (Date.now() - stageStartedAt) / 1000;
    // Network items only: counting cache hits made a thumbnail stage report
    // 1.4 million a minute and an ETA of zero.
    const perMinute = stageSeconds > 5 ? +(state.network / (stageSeconds / 60)).toFixed(1) : null;
    const left = state.total - state.done;
    await mkdir(dir, { recursive: true });
    await writeFile(
      progressPath,
      JSON.stringify(
        {
          ...state,
          command,
          pid: process.pid,
          inflight,
          perMinute,
          minutesLeft: perMinute > 0 && left > 0 ? Math.round(left / perMinute) : null,
          startedAt: new Date(startedAt).toISOString(),
          lastAdvanceAt: new Date(lastAdvance).toISOString(),
          updatedAt: new Date().toISOString(),
          ...extra,
        },
        null,
        2,
      ),
    ).catch(() => {});
  };

  const heartbeat = setInterval(() => {
    if (Date.now() >= deadline) stop('reached the --minutes limit');
    void write();
  }, HEARTBEAT_MS);
  heartbeat.unref(); // a heartbeat must never be what keeps the process alive

  void trimLog(logPath);

  return {
    signal: aborter.signal,
    log: tee,
    get stopped() {
      return aborter.signal.aborted || Date.now() >= deadline;
    },
    get reason() {
      return paused ? 'paused with Ctrl+C' : 'reached the --minutes limit';
    },
    /** `network` counts items that actually crossed the wire; `done` counts all. */
    async progress(next) {
      if (next.stage && next.stage !== state.stage) {
        stageStartedAt = Date.now();
        state = { ...state, network: 0 };
      }
      if (next.done !== undefined && next.done !== state.done) lastAdvance = Date.now();
      state = { ...state, ...next };
    },
    /** Wrap a request so status can show how many are in flight. */
    async track(promise) {
      inflight++;
      try {
        return await promise;
      } finally {
        inflight--;
      }
    },
    /** Interruptible sleep, so a 90s WAF cooldown does not swallow a Ctrl+C. */
    async wait(ms) {
      const until = Date.now() + ms;
      while (Date.now() < until && !aborter.signal.aborted) {
        await new Promise((r) => setTimeout(r, Math.min(500, until - Date.now())));
      }
    },
    finish: (extra) => write({ inflight: 0, ...extra }),
    release() {
      clearInterval(heartbeat);
      process.off('SIGINT', onSigint);
    },
  };
}
