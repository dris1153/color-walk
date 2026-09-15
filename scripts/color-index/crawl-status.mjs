#!/usr/bin/env node
// Reads what a running crawl writes. Opening a file cannot disturb the crawl,
// so this is safe to run from a second terminal at any time.
import { readFile } from 'node:fs/promises';
import { HEARTBEAT_MS, LOCK_PATH, LOG_PATH, PROGRESS_PATH, isAlive } from './crawl-control.mjs';

/** Past this with requests in flight and no item landing, call it stalled. */
const STALL_AFTER_MS = 2 * 60_000;

const raw = await readFile(PROGRESS_PATH, 'utf8').catch(() => null);
const lock = await readFile(LOCK_PATH, 'utf8').catch(() => null);
const logTail = (await readFile(LOG_PATH, 'utf8').catch(() => ''))
  .trim()
  .split('\n')
  .slice(-3);

if (!raw) {
  console.log('No crawl has written progress yet. Start one with: npm run build:index');
  process.exit(0);
}

const p = JSON.parse(raw);
const now = Date.now();
const ago = (iso) => Math.round((now - Date.parse(iso)) / 1000);
const pct = p.total ? ` (${Math.round((p.done / p.total) * 100)}%)` : '';
const lockPid = Number(lock);
const running = Number.isInteger(lockPid) && isAlive(lockPid);
const heartbeatAge = ago(p.updatedAt);
const advanceAge = ago(p.lastAdvanceAt ?? p.updatedAt);

let verdict;
if (p.finished) verdict = `finished: ${p.finished}`;
else if (!running) verdict = `NOT RUNNING - last heartbeat ${heartbeatAge}s ago, no live process holds the lock`;
else if (heartbeatAge > HEARTBEAT_MS / 1000 + 10) verdict = `SILENT - process ${lockPid} is alive but stopped writing ${heartbeatAge}s ago`;
else if (p.inflight > 0 && advanceAge * 1000 > STALL_AFTER_MS) verdict = `STALLED - ${p.inflight} requests in flight, nothing landed for ${advanceAge}s`;
else verdict = `running (pid ${lockPid})`;

console.log(`status     ${verdict}`);
console.log(`stage      ${p.stage}`);
console.log(`progress   ${p.done}/${p.total || '?'}${pct}`);
if (p.inflight) console.log(`in flight  ${p.inflight}`);
if (p.perMinute !== null && p.perMinute !== undefined) console.log(`rate       ${p.perMinute}/min over the network`);
if (p.minutesLeft != null) console.log(`remaining  ~${p.minutesLeft} min at this rate`);
console.log(`advanced   ${advanceAge}s ago`);
console.log(`heartbeat  ${heartbeatAge}s ago`);
console.log(`started    ${p.startedAt}`);
console.log(`command    ${p.command}`);
if (logTail.length && logTail[0]) {
  console.log('log');
  for (const line of logTail) console.log(`  ${line}`);
}
