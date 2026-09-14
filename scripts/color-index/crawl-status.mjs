#!/usr/bin/env node
// Reads the progress file a running crawl writes. Opening a file cannot
// disturb the crawl, so this is safe to run from a second terminal at any time.
import { readFile } from 'node:fs/promises';
import { PROGRESS_PATH } from './crawl-control.mjs';

const raw = await readFile(PROGRESS_PATH, 'utf8').catch(() => null);
if (!raw) {
  console.log('No crawl has written progress yet. Start one with: npm run build:index');
  process.exit(0);
}

const p = JSON.parse(raw);
const pct = p.total ? ` (${Math.round((p.done / p.total) * 100)}%)` : '';
const staleFor = Math.round((Date.now() - Date.parse(p.updatedAt)) / 1000);

console.log(`stage      ${p.stage}`);
console.log(`progress   ${p.done}/${p.total || '?'}${pct}`);
if (p.perMinute !== null) console.log(`rate       ${p.perMinute}/min`);
if (p.minutesLeft != null) console.log(`remaining  ~${p.minutesLeft} min at this rate`);
console.log(`started    ${p.startedAt}`);
console.log(`updated    ${p.updatedAt} (${staleFor}s ago)`);
if (p.finished) console.log(`finished   ${p.finished}`);
console.log(`command    ${p.command}`);
