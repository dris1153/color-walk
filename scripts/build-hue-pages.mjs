#!/usr/bin/env node
// A real page per hue, because `#h=210` is a fragment: the browser never sends
// it, so a crawler reading a shared link only ever sees the site's front page.
// Each page is dist/index.html with its social tags rewritten; the app reads the
// path on boot, so /c/210 opens on that hue and every #h= link still works.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import names from '../src/lib/bucket-color-names.json' with { type: 'json' };
import { BUCKET_WIDTH } from './color-index/write-bucket-files.mjs';

const DIST = path.join(import.meta.dirname, '..', 'dist');
const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * Rewrites one meta tag's content, whether it sits on one line or three.
 * String scanning rather than a regex: the tags span lines, and an escaped
 * pattern is one backslash away from silently matching nothing.
 */
function setMeta(html, attr, key, value) {
  const at = html.indexOf(`${attr}="${key}"`);
  if (at === -1) throw new Error(`no ${attr}="${key}" meta to rewrite`);
  const from = html.indexOf('content="', at);
  const close = html.indexOf('"', from + 9);
  if (from === -1 || close === -1) throw new Error(`${attr}="${key}" has no content to rewrite`);
  return html.slice(0, from + 9) + escape(value) + html.slice(close);
}

function page(html, { origin, slug, title, description, image }) {
  const titleAt = html.indexOf('<title>');
  const titleEnd = html.indexOf('</title>', titleAt);
  if (titleAt === -1 || titleEnd === -1) throw new Error('dist/index.html has no title');
  let out = html.slice(0, titleAt + 7) + escape(title) + html.slice(titleEnd);
  out = setMeta(out, 'name', 'description', description);
  out = setMeta(out, 'property', 'og:title', title);
  out = setMeta(out, 'property', 'og:description', description);
  out = setMeta(out, 'property', 'og:url', `${origin}/c/${slug}`);
  out = setMeta(out, 'property', 'og:image', `${origin}${image}`);
  return out;
}

async function main() {
  const html = await readFile(path.join(DIST, 'index.html'), 'utf8');
  const urlAt = html.indexOf('property="og:url"');
  const from = html.indexOf('content="', urlAt) + 9;
  const origin = html.slice(from, html.indexOf('"', from)).replace(/\/$/, '');
  if (!origin) throw new Error('dist/index.html has no og:url to take the origin from');

  const images = new Set(await readdir(path.join(DIST, 'og')).catch(() => []));
  const written = [];

  for (let bucket = 0; bucket < names.length; bucket++) {
    const hue = Math.round(bucket * BUCKET_WIDTH);
    const file = `h-${String(hue).padStart(3, '0')}.jpg`;
    if (!images.has(file)) continue; // an empty hue has no card and no page
    const name = names[bucket];
    await mkdir(path.join(DIST, 'c', String(hue)), { recursive: true });
    await writeFile(
      path.join(DIST, 'c', String(hue), 'index.html'),
      page(html, {
        origin,
        slug: String(hue),
        title: `${name} - Color Walk`,
        description: `Public-domain works in ${name.toLowerCase()}, from the Met, the Cleveland Museum of Art, the Rijksmuseum and the National Gallery of Art.`,
        image: `/og/${file}`,
      }),
    );
    written.push(hue);
  }

  if (images.has('grey.jpg')) {
    await mkdir(path.join(DIST, 'c', 'grey'), { recursive: true });
    await writeFile(
      path.join(DIST, 'c', 'grey', 'index.html'),
      page(html, {
        origin,
        slug: 'grey',
        title: 'Monochrome - Color Walk',
        description: 'Ink, calligraphy and prints: public-domain works with a tone and no hue.',
        image: '/og/grey.jpg',
      }),
    );
    written.push('grey');
  }

  console.log(`wrote ${written.length} hue pages under dist/c/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
