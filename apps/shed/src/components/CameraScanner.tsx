import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CircleCheck, Flashlight, FlashlightOff, ImageUp, Camera, TriangleAlert, X } from 'lucide-react';
import { FRAME_ASPECT, SCAN_THRESHOLDS as T } from '../config/scanThresholds';
import {
  assessFrame,
  coverRectToSource,
  initialHintState,
  measureFrame,
  nextHintState,
  SCAN_HINTS,
  toGray,
  type HintState,
  type Rect,
  type ScanIssue,
} from '../lib/frameAnalysis';
import { useFocusTrap } from '../lib/useFocusTrap';

export type CameraProblem = 'denied' | 'none' | 'busy' | 'other';

interface CameraScannerProps {
  onClose: () => void;
  /** Called with the photo cropped to the frame, plus the open issue if the checks hadn't passed. */
  onCapture: (photo: Blob, issue: ScanIssue | null) => void;
  /** Camera couldn't start. The dialog stays open with fallback buttons. */
  onUnavailable: (problem: CameraProblem) => void;
  /** Fallback buttons: these must run inside the click so the file picker is allowed to open. */
  onUseCameraApp: () => void;
  onChoosePhoto: () => void;
  restoreFocusRef?: React.RefObject<HTMLElement | null>;
}

const PROBLEM_TEXT: Record<CameraProblem, string> = {
  denied: 'Camera access is off for this site. You can turn it on in your browser settings, or take the photo with your camera app instead.',
  none: 'No camera was found. You can choose a photo of the label instead.',
  busy: 'The camera is in use by another app. Close it and try again, or use your camera app instead.',
  other: 'The camera couldn’t start. You can take the photo with your camera app or choose one instead.',
};

function problemFrom(err: unknown): CameraProblem {
  const name = (err as { name?: string } | null)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'none';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'other';
}

type TorchCaps = MediaTrackCapabilities & { torch?: boolean; focusMode?: string[] };

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Area of the camera image under the alignment frame, in camera pixels. */
function frameCrop(video: HTMLVideoElement, frame: HTMLElement): Rect {
  const vr = video.getBoundingClientRect();
  const fr = frame.getBoundingClientRect();
  return coverRectToSource(
    { x: fr.left - vr.left, y: fr.top - vr.top, width: fr.width, height: fr.height },
    vr.width,
    vr.height,
    video.videoWidth,
    video.videoHeight
  );
}

/**
 * Full-screen live camera with a label-shaped alignment frame. A few times a
 * second it checks a small grayscale copy of the area inside the frame for
 * light, glare, movement, and focus, and shows one plain hint. Everything runs
 * on the device; nothing is uploaded.
 */
export const CameraScanner: React.FC<CameraScannerProps> = ({
  onClose,
  onCapture,
  onUnavailable,
  onUseCameraApp,
  onChoosePhoto,
  restoreFocusRef,
}) => {
  const titleId = useId();
  const hintId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevGrayRef = useRef<Uint8Array | null>(null);
  const hintStateRef = useRef<HintState>(initialHintState);
  const lastAnnounceAtRef = useRef(0);
  const lastAnnouncedRef = useRef('');

  const [phase, setPhase] = useState<'starting' | 'live' | 'error'>('starting');
  const [problem, setProblem] = useState<CameraProblem | null>(null);
  const [issue, setIssue] = useState<ScanIssue | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useFocusTrap(true, dialogRef, onClose, closeRef, restoreFocusRef);

  // Lock page scroll behind the camera.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Start the rear camera; stop every track when the dialog closes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error('No camera API'), { name: 'NotFoundError' });
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        const track = stream.getVideoTracks()[0];
        const caps = (track?.getCapabilities?.() ?? {}) as TorchCaps;
        setTorchSupported(caps.torch === true);
        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          track
            .applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
            .catch(() => undefined);
        }
        if (!cancelled) setPhase('live');
      } catch (err) {
        if (cancelled) return;
        console.warn('Camera unavailable', err);
        const p = problemFrom(err);
        setProblem(p);
        setPhase('error');
        onUnavailable(p);
      }
    })();
    return () => {
      cancelled = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check the framed area a few times a second while aiming.
  useEffect(() => {
    if (phase !== 'live') return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const id = window.setInterval(() => {
      const video = videoRef.current;
      const frame = frameRef.current;
      if (!video || !frame || document.hidden || video.readyState < 2 || !video.videoWidth) return;
      const crop = frameCrop(video, frame);
      if (crop.width < 16 || crop.height < 16) return;
      const w = T.ANALYSIS_WIDTH;
      const h = Math.max(16, Math.round((w * crop.height) / crop.width));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        prevGrayRef.current = null;
      }
      ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
      const gray = toGray(ctx.getImageData(0, 0, w, h).data, w, h);
      const metrics = measureFrame(gray, w, h, prevGrayRef.current);
      prevGrayRef.current = gray;
      hintStateRef.current = nextHintState(hintStateRef.current, assessFrame(metrics));
      setIssue(hintStateRef.current.shown);
    }, T.ANALYSIS_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [phase]);

  // Screen readers hear the latest hint at most every few seconds, never a stream of them.
  useEffect(() => {
    const text = phase === 'error' && problem ? PROBLEM_TEXT[problem] : issue ? SCAN_HINTS[issue] : '';
    if (!text) return;
    const wait = Math.max(0, lastAnnounceAtRef.current + T.ANNOUNCE_INTERVAL_MS - Date.now());
    const timer = window.setTimeout(() => {
      if (lastAnnouncedRef.current === text) return;
      lastAnnouncedRef.current = text;
      lastAnnounceAtRef.current = Date.now();
      setAnnouncement(text);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [issue, phase, problem]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }, [torchOn]);

  const capture = async () => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video || !frame || !video.videoWidth || capturing) return;
    setCapturing(true);
    try {
      const crop = frameCrop(video, frame);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(crop.width));
      canvas.height = Math.max(1, Math.round(crop.height));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Capture failed');
      onCapture(blob, issue && issue !== 'ok' ? issue : null);
    } catch (err) {
      console.error(err);
      setCapturing(false);
    }
  };

  const ready = phase === 'live' && issue === 'ok';
  const hintText = phase === 'live' ? SCAN_HINTS[issue ?? 'starting'] : phase === 'starting' ? SCAN_HINTS.starting : '';

  return (
    <div
      ref={dialogRef}
      className="camera-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={hintId}
      tabIndex={-1}
    >
      <video ref={videoRef} className="camera-video" playsInline muted autoPlay aria-hidden="true" />

      <div className="camera-overlay">
        <div className="camera-top">
          <button ref={closeRef} type="button" className="camera-round-btn" aria-label="Close camera" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
          <h2 id={titleId} className="camera-title">
            Scan label
          </h2>
          {torchSupported && phase === 'live' ? (
            <button
              type="button"
              className={`camera-round-btn${torchOn ? ' is-on' : ''}`}
              aria-label="Flashlight"
              aria-pressed={torchOn}
              onClick={toggleTorch}
            >
              {torchOn ? <Flashlight size={20} aria-hidden="true" /> : <FlashlightOff size={20} aria-hidden="true" />}
            </button>
          ) : (
            <span className="camera-round-spacer" aria-hidden="true" />
          )}
        </div>

        <div className="camera-frame-area">
          {phase !== 'error' ? (
            <div
              ref={frameRef}
              className={`camera-frame${ready ? ' is-ready' : ''}`}
              style={{ '--frame-aspect': FRAME_ASPECT } as React.CSSProperties}
              aria-hidden="true"
            >
              <span className="camera-corner tl" />
              <span className="camera-corner tr" />
              <span className="camera-corner bl" />
              <span className="camera-corner br" />
            </div>
          ) : (
            <div className="camera-problem">
              <TriangleAlert size={28} aria-hidden="true" />
              <p>{problem ? PROBLEM_TEXT[problem] : PROBLEM_TEXT.other}</p>
              <div className="camera-problem-actions">
                {problem !== 'none' && (
                  <button type="button" className="primary-btn" onClick={onUseCameraApp}>
                    <Camera size={17} aria-hidden="true" /> Use camera app
                  </button>
                )}
                <button type="button" className={problem === 'none' ? 'primary-btn' : 'secondary-btn'} onClick={onChoosePhoto}>
                  <ImageUp size={16} aria-hidden="true" /> Choose photo
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="camera-bottom">
          <p id={hintId} className={`camera-hint${ready ? ' is-ready' : issue && phase === 'live' ? ' is-warn' : ''}`} hidden={!hintText}>
            {phase === 'live' && issue && (ready ? <CircleCheck size={16} aria-hidden="true" /> : <TriangleAlert size={16} aria-hidden="true" />)}
            <span>{hintText}</span>
          </p>
          <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
            {announcement}
          </p>
          {phase !== 'error' && (
            <>
              <div className="camera-controls">
                <button type="button" className="camera-round-btn" aria-label="Choose a photo instead" onClick={onChoosePhoto}>
                  <ImageUp size={20} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`camera-shutter${ready ? ' is-ready' : ''}`}
                  aria-label={ready ? 'Take photo, looks good' : 'Take photo anyway, it may not read well'}
                  disabled={phase !== 'live' || capturing}
                  onClick={capture}
                >
                  <span className="camera-shutter-inner" />
                </button>
                <span className="camera-round-spacer" aria-hidden="true" />
              </div>
              <p className="camera-note" aria-hidden={ready}>
                {phase === 'live' && !ready ? 'You can still take it, but it may not read well.' : '\u00a0'}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
