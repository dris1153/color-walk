#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const HTML = path.join(import.meta.dirname, '..', 'dist', 'index.html');

const html = await readFile(HTML, 'utf8');
const problems = [];

// Vite leaves `%VITE_FOO%` untouched when the variable is undefined, so a
// missing value ships the literal placeholder instead of failing.
const placeholder = html.match(/%VITE_[A-Z0-9_]+%/);
if (placeholder) {
  problems.push(`${placeholder[0]} was never defined, so it shipped verbatim`);
}

// A committed .env means a forgotten dashboard variable does not leave a
// placeholder - it leaves a well-formed localhost URL, which the check above
// cannot see. On Vercel that is always wrong.
if (process.env.VERCEL && /content="[^"]*localhost/.test(html)) {
  problems.push('a localhost URL reached a production build: set VITE_APP_URL in the Vercel project');
}

if (problems.length > 0) {
  console.error('dist/index.html failed its environment check:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log('dist/index.html environment check passed');
