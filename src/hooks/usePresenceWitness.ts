import { FaceDetector as MpFaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { useEffect, useRef, useState } from 'react';
import type { CamMode } from '../types/solaris';

interface NativeFace {
  boundingBox?: { width: number; height: number };
}

interface NativeFaceDetector {
  detect(source: HTMLVideoElement): Promise<NativeFace[]>;
}

interface PresenceState {
  status: 'off' | 'present' | 'away' | 'blocked';
  text: string;
  timerText: string;
}

const AWAY_GRACE_SEC = 3;
const OFF_STATE: PresenceState = {
  status: 'off',
  text: 'Sensor off',
  timerText: '',
};

export function usePresenceWitness(
  mode: CamMode,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  onAway: () => void,
  onReturn: () => void,
): PresenceState {
  const [activePresence, setActivePresence] = useState<PresenceState>({
    status: 'present',
    text: 'Calibrating...',
    timerText: '',
  });

  const onAwayRef = useRef(onAway);
  const onReturnRef = useRef(onReturn);

  useEffect(() => {
    onAwayRef.current = onAway;
    onReturnRef.current = onReturn;
  }, [onAway, onReturn]);

  useEffect(() => {
    if (mode === 'off') {
      return;
    }

    const videoEl = videoRef.current;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let intervalId: number | null = null;
    let mpDetector: MpFaceDetector | null = null;
    let prevGray: Float32Array | null = null;
    let awaySec = 0;
    let currentlyAway = false;
    let smoothedMotion = 0;
    let lastMpTimestamp = 0;
    let mpLoadFailed = false;
    let isDetecting = false;

    const pCanvas = document.createElement('canvas');
    pCanvas.width = 64;
    pCanvas.height = 48;
    const pCtx = pCanvas.getContext('2d', { willReadFrequently: true });

    let nativeDetector: NativeFaceDetector | null = null;
    const WinWithFD = window as unknown as {
      FaceDetector?: new (opts: { fastMode: boolean; maxDetectedFaces: number }) => NativeFaceDetector;
    };
    if (WinWithFD.FaceDetector) {
      try {
        nativeDetector = new WinWithFD.FaceDetector({
          fastMode: true,
          maxDetectedFaces: 2,
        });
      } catch {
        nativeDetector = null;
      }
    }

    async function loadMpDetector() {
      try {
        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        const detector = await MpFaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: '/mediapipe/models/blaze_face_short_range.tflite',
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5,
        });
        if (cancelled) {
          detector.close();
          return;
        }
        mpDetector = detector;
      } catch {
        mpLoadFailed = true;
        mpDetector = null;
      }
    }

    async function checkPresence() {
      if (cancelled || !videoEl || videoEl.readyState < 2 || !pCtx || isDetecting) return;
      isDetecting = true;

      try {
        let hasFace = false;
        const faceEngineReady = Boolean(mpDetector || nativeDetector || mpLoadFailed);

        // 1. Primary: Local MediaPipe BlazeFace detector
        if (mpDetector && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
          try {
            const nowMs = Math.max(lastMpTimestamp + 1, Math.round(performance.now()));
            lastMpTimestamp = nowMs;
            const result = mpDetector.detectForVideo(videoEl, nowMs);
            if (result.detections.length > 0) {
              hasFace = result.detections.some((det) => {
                const bb = det.boundingBox;
                return Boolean(bb && bb.width > 28 && bb.height > 28);
              });
            }
          } catch {
            // Treat as no face detected on transient video frame error
          }
        }

        // 2. Secondary: Browser native FaceDetector only if MediaPipe failed to load
        if (!hasFace && mpLoadFailed && nativeDetector) {
          try {
            const faces = await nativeDetector.detect(videoEl);
            for (const f of faces) {
              if (f.boundingBox && f.boundingBox.width > 24 && f.boundingBox.height > 24) {
                hasFace = true;
                break;
              }
            }
          } catch {
            // No face detected
          }
        }

        // 3. Fallback motion check ONLY if both MediaPipe & native FaceDetector are unavailable
        let isPresent = hasFace;
        if (!mpDetector && mpLoadFailed && !nativeDetector) {
          pCtx.drawImage(videoEl, 0, 0, 64, 48);
          const d = pCtx.getImageData(0, 0, 64, 48).data;

          let motionDiff = 0;
          let centerPixels = 0;
          const curGray = new Float32Array(64 * 48);

          for (let i = 0; i < 64 * 48; i++) {
            curGray[i] = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
            const px = i % 64;
            const py = Math.floor(i / 64);

            if (px >= 14 && px <= 50 && py >= 4 && py <= 42) {
              centerPixels++;
              if (prevGray) motionDiff += Math.abs(curGray[i] - prevGray[i]);
            }
          }

          prevGray = curGray;
          const avgMotion = centerPixels > 0 ? motionDiff / centerPixels : 0;
          smoothedMotion = smoothedMotion * 0.65 + avgMotion * 0.35;
          isPresent = smoothedMotion > 3.2;
        }

        if (cancelled || !faceEngineReady) return;

        if (isPresent) {
          awaySec = 0;
          setActivePresence({
            status: 'present',
            text: hasFace ? 'Face verified' : 'Present at desk',
            timerText: '',
          });
          if (currentlyAway) {
            currentlyAway = false;
            onReturnRef.current();
          }
        } else {
          awaySec += 1;
          if (awaySec < AWAY_GRACE_SEC) {
            setActivePresence({
              status: 'away',
              text: `Away in ${AWAY_GRACE_SEC - awaySec}s...`,
              timerText: `${awaySec}s`,
            });
          } else {
            setActivePresence({
              status: 'away',
              text: 'Away — paused',
              timerText: `${awaySec}s`,
            });
            if (!currentlyAway) {
              currentlyAway = true;
              onAwayRef.current();
            }
          }
        }
      } finally {
        isDetecting = false;
      }
    }

    async function initCamera() {
      try {
        const [mediaStream] = await Promise.all([
          navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
          }),
          loadMpDetector(),
        ]);

        stream = mediaStream;
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (!videoEl) return;
        videoEl.srcObject = stream;
        await videoEl.play();

        setActivePresence({ status: 'present', text: 'Calibrating...', timerText: '' });
        void checkPresence();
        intervalId = window.setInterval(() => {
          void checkPresence();
        }, 1000);
      } catch {
        if (!cancelled) {
          setActivePresence({ status: 'blocked', text: 'Camera blocked', timerText: '' });
        }
      }
    }

    void initCamera();

    return () => {
      cancelled = true;
      if (intervalId !== null) window.clearInterval(intervalId);
      if (mpDetector) {
        mpDetector.close();
        mpDetector = null;
      }
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [mode, videoRef]);

  return mode === 'off' ? OFF_STATE : activePresence;
}
