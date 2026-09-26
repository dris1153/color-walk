import { describe, expect, it } from 'vitest';
import { displayUrl } from '../display-url';

const thumb = 'https://images.metmuseum.org/CRDImages/ep/web-large/DT1567.jpg';

describe('displayUrl', () => {
  it('asks a IIIF service for a 1600 px render', () => {
    expect(displayUrl({ thumb, big: 'https://iiif.micr.io/zNDdr/info.json', bigBytes: null })).toBe(
      'https://iiif.micr.io/zNDdr/full/!1600,1600/0/default.jpg',
    );
  });

  it('uses a modest master file, and the thumbnail for a heavy or unknown one', () => {
    const big = 'https://images.metmuseum.org/CRDImages/ep/original/DT1567.jpg';
    expect(displayUrl({ thumb, big, bigBytes: 3_000_000 })).toBe(big);
    expect(displayUrl({ thumb, big, bigBytes: 40_000_000 })).toBe(thumb);
    expect(displayUrl({ thumb, big, bigBytes: null })).toBe(thumb);
  });

  it('never returns a master on a host outside the allowlist', () => {
    expect(displayUrl({ thumb, big: 'https://evil.example/x.jpg', bigBytes: 10 })).toBe(thumb);
  });
});
