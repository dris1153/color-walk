#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.join(import.meta.dirname, '..', 'dist');

/** The per-hue pages are copies of index.html, so they can ship the same faults. */
async function allPages() {
  const pages = [['index.html', await readFile(path.join(DIST, 'index.html'), 'utf8')]];
  for (const slug of await readdir(path.join(DIST, 'c')).catch(() => [])) {
    pages.push([`c/${slug}/index.html`, await readFile(path.join(DIST, 'c', slug, 'index.html'), 'utf8')]);
  }
  return pages;
}

const pages = await allPages();
const problems = [];
for (const [name, html] of pages) {

  // Vite leaves `%VITE_FOO%` untouched when the variable is undefined, so a
  // missing value ships the literal placeholder instead of failing.
  const placeholder = html.match(/%VITE_[A-Z0-9_]+%/);
  if (placeholder) {
    problems.push(`${name}: ${placeholder[0]} was never defined, so it shipped verbatim`);
  }

  // A committed .env means a forgotten dashboard variable does not leave a
  // placeholder - it leaves a well-formed localhost URL, which the check above
  // cannot see. On Vercel that is always wrong.
  if (process.env.VERCEL && /content="[^"]*localhost/.test(html)) {
    problems.push(`${name}: a localhost URL reached a production build: set VITE_APP_URL in the Vercel project`);
  }
}

if (problems.length > 0) {
  console.error('the built pages failed their environment check:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(`${pages.length} built pages passed their environment check`);
