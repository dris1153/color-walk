/**
 * sRGB to CIE Lab (D65). The mosaic matches in Lab because equal distances
 * there look roughly equally different, which RGB distances do not.
 * Mirrored in src/lib/lab.ts: change one and the other must follow.
 */
const linear = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

export function rgbToLab(r, g, b) {
  const [R, G, B] = [linear(r), linear(g), linear(b)];
  const x = f((R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047);
  const y = f(R * 0.2126 + G * 0.7152 + B * 0.0722);
  const z = f((R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** Mean colour of raw RGB(A) pixels. */
export function meanRgb(data, channels) {
  let r = 0;
  let g = 0;
  let b = 0;
  const n = Math.floor(data.length / channels);
  for (let i = 0; i + channels <= data.length; i += channels) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  }
  return n > 0 ? [r / n, g / n, b / n] : [0, 0, 0];
}
