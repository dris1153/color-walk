import { describe, expect, it } from 'vitest';
import { bucketFileUrl, isAllowedImageUrl, isAllowedPageUrl } from '../image-url';

describe('isAllowedImageUrl', () => {
  it('accepts both museum CDNs over https', () => {
    expect(isAllowedImageUrl('https://images.metmuseum.org/CRDImages/ep/web-large/DT1.jpg')).toBe(true);
    expect(isAllowedImageUrl('https://openaccess-cdn.clevelandart.org/1915.534/1915.534_web.jpg')).toBe(true);
  });

  it('rejects plain http', () => {
    expect(isAllowedImageUrl('http://images.metmuseum.org/x.jpg')).toBe(false);
  });

  it('rejects subdomain spoofs', () => {
    expect(isAllowedImageUrl('https://images.metmuseum.org.evil.com/x.jpg')).toBe(false);
    expect(isAllowedImageUrl('https://evil.com/images.metmuseum.org/x.jpg')).toBe(false);
  });

  it('rejects javascript:, protocol-relative and junk', () => {
    expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageUrl('//images.metmuseum.org/x.jpg')).toBe(false);
    expect(isAllowedImageUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isAllowedImageUrl('')).toBe(false);
  });
});

describe('isAllowedPageUrl', () => {
  it('accepts the two museum sites only', () => {
    expect(isAllowedPageUrl('https://www.metmuseum.org/art/collection/search/436535')).toBe(true);
    expect(isAllowedPageUrl('https://www.clevelandart.org/art/1915.534')).toBe(true);
    // The CMA API emits the bare host.
    expect(isAllowedPageUrl('https://clevelandart.org/art/1915.534')).toBe(true);
    expect(isAllowedPageUrl('https://images.metmuseum.org/x.jpg')).toBe(false);
    expect(isAllowedPageUrl('https://clevelandart.org.evil.com/art/1')).toBe(false);
  });
});

describe('bucketFileUrl', () => {
  it('zero-pads the bucket index', () => {
    expect(bucketFileUrl(0)).toBe('/index/bucket-00.json');
    expect(bucketFileUrl(14)).toBe('/index/bucket-14.json');
    expect(bucketFileUrl(null)).toBe('/index/all.json');
  });
});
