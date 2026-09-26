import { useEffect, useRef, useState } from 'react';
import { changedEnough, type Reading } from '../lib/camera-colour';
import { hslToHex, type HueSelection } from '../lib/color-math';
import { nearestColorName } from '../lib/color-name-table';
import { SAMPLE_EDGE, dominantColorFromPixels } from '../lib/image-colour';
import { pixelsAt } from '../lib/read-image-file';

type Props = {
  onColour: (hue: HueSelection, lightness: number) => void;
  onClose: () => void;
};

const SAMPLE_MS = 1000;

/**
 * Point the phone at something and the grid follows its colour. Frames are
 * read into a canvas in this page once a second and never leave it; the stream
 * stops the moment this closes. Needs `camera=(self)` in Permissions-Policy.
 */
export function CameraColour({ onColour, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const last = useRef<Reading | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stale = false;

    const sample = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      const scale = Math.min(SAMPLE_EDGE / video.videoWidth, SAMPLE_EDGE / video.videoHeight);
      const data = pixelsAt(video, Math.max(1, Math.round(video.videoWidth * scale)), Math.max(1, Math.round(video.videoHeight * scale)));
      const colour = dominantColorFromPixels(data);
      if (!colour) return;
      const next: Reading = { hue: colour.neutral ? 'grey' : colour.hue, lig: colour.lig };
      if (!changedEnough(last.current, next)) return;
      last.current = next;
      setReading(next);
      onColour(next.hue, next.lig);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then((s) => {
        if (stale) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          void video.play();
        }
        timer = window.setInterval(sample, SAMPLE_MS);
      })
      .catch(() => !stale && setError('The camera is not available here.'));
    if (!navigator.mediaDevices) setError('This browser has no camera access.');

    return () => {
      stale = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // onColour is stable (a useCallback); restarting the camera on its change would flicker it.
  }, []);

  const swatch = reading
    ? typeof reading.hue === 'number' ? hslToHex(reading.hue, 60, reading.lig) : hslToHex(0, 0, reading.lig)
    : '#333333';

  return (
    <div className="fixed right-3 top-3 z-40 flex w-40 flex-col gap-2 border border-ink/20 bg-ground/90 p-2 backdrop-blur" role="region" aria-label="Colour from the camera">
      <video ref={videoRef} muted playsInline className="aspect-video w-full bg-black object-cover" />
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest uppercase text-ink/70" aria-live="polite">
        <span aria-hidden className="h-4 w-4 shrink-0 border border-ink/20" style={{ backgroundColor: swatch }} />
        {error ?? (reading ? (typeof reading.hue === 'number' ? nearestColorName(reading.hue) : 'Monochrome') : 'Looking')}
      </div>
      <button type="button" onClick={onClose} className="border border-ink/25 py-1 font-mono text-[10px] tracking-widest uppercase text-ink/70 hover:text-ink">
        Stop camera
      </button>
    </div>
  );
}
