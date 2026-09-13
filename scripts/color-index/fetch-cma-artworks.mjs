import { getJson, sleep } from './http-util.mjs';

const PAGE_SIZE = 1000;
const FIELDS = [
  'id',
  'title',
  'creators',
  'creation_date',
  'images',
  'type',
  'url',
  'accession_number',
  'creditline',
  'share_license_status',
].join(',');

const pageUrl = (skip) =>
  'https://openaccess-api.clevelandart.org/api/artworks/' +
  `?cc0=1&has_image=1&type=Painting&limit=${PAGE_SIZE}&skip=${skip}&fields=${FIELDS}`;

export async function fetchCmaArtworks({ limit = Infinity, log = console.log } = {}) {
  const out = [];
  for (let skip = 0; out.length < limit; skip += PAGE_SIZE) {
    const res = await getJson(pageUrl(skip));
    const data = Array.isArray(res?.data) ? res.data : [];
    out.push(...data);
    log(`cma: ${out.length} artworks`);
    if (data.length < PAGE_SIZE) break;
    await sleep(150);
  }
  return out.slice(0, limit === Infinity ? out.length : limit);
}
