"use client";

/**
 * Composant de capture média (photo et vidéo) via la webcam.
 * 
 * Modes :
 *   - "photo" : capture une image fixe depuis la caméra
 *   - "video" : enregistre une vidéo via MediaRecorder
 * 
 * Le fichier capturé est retourné sous forme de Blob avec le bon type MIME,
 * prêt à être uploadé via l'API /api/upload.
 */

import { useState, useRef, useCallback, useEffect } from "react";

export type CaptureMode = "photo" | "video";

interface MediaCaptureProps {
  mode: CaptureMode;
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function MediaCapture({ mode, onCapture, onClose }: MediaCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [status, setStatus] = useState<"starting" | "ready" | "recording" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Démarrer la caméra ──
  const startCamera = useCallback(async () => {
    setStatus("starting");
    setError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment", // caméra arrière par défaut sur mobile
        },
        audio: mode === "video",
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("ready");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Accès caméra refusé";
      setError(msg);
      setStatus("error");
    }
  }, [mode]);

  useEffect(() => {
    startCamera();
    return () => {
      stopMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopMedia = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // ── Capture photo ──
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: "image/jpeg" });
        stopMedia();
        onCapture(file);
      },
      "image/jpeg",
      0.92
    );
  }, [stopMedia, onCapture]);

  // ── Enregistrement vidéo ──
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    // Détecter le meilleur codec
    let mimeType = "video/webm";
    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp9")) {
      mimeType = "video/webm;codecs=vp9";
    } else if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
      mimeType = "video/webm;codecs=vp8";
    }

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const ext = mimeType.includes("webm") ? "webm" : "mp4";
      const file = new File([blob], `video_${Date.now()}.${ext}`, { type: mimeType });
      stopMedia();
      onCapture(file);
    };

    recorder.start(1000); // chunks de 1s
    setStatus("recording");
    setRecordingTime(0);
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => {
        if (prev >= 120) { // max 2 minutes
          stopRecording();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopMedia, onCapture]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  // ── Rendu ──
  if (status === "error") {
    return (
      <div className="capture-overlay">
        <div className="capture-box">
          <div className="capture-error">
            <p>❌ {error || "Impossible d'accéder à la caméra"}</p>
            <button className="capture-btn" onClick={onClose}>Fermer</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CAPTURE_STYLES }} />
      <div className="capture-overlay" onClick={(e) => { if (e.target === e.currentTarget) { stopMedia(); onClose(); } }}>
        <div className="capture-box">
          {/* Vue caméra */}
          <div className="capture-viewfinder">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="capture-video"
            />
            <canvas ref={canvasRef} style={{ display: "none" }} />

            {/* Indicateur d'enregistrement */}
            {status === "recording" && (
              <div className="recording-indicator">
                <span className="rec-dot" />
                <span>{formatTime(recordingTime)}</span>
              </div>
            )}

            {/* Chargement */}
            {status === "starting" && (
              <div className="capture-loading">
                <div className="spinner" />
                <span>Démarrage caméra...</span>
              </div>
            )}
          </div>

          {/* Contrôles */}
          <div className="capture-controls">
            {mode === "photo" ? (
              <>
                <button className="capture-btn secondary" onClick={() => { stopMedia(); onClose(); }}>
                  Annuler
                </button>
                <button
                  className="capture-btn primary capture-shutter"
                  onClick={capturePhoto}
                  disabled={status !== "ready"}
                >
                  📸
                </button>
                <button
                  className="capture-btn secondary"
                  onClick={() => { stopMedia(); startCamera(); }}
                  disabled={status !== "ready"}
                >
                  🔄
                </button>
              </>
            ) : (
              <>
                <button className="capture-btn secondary" onClick={() => { stopMedia(); onClose(); }}>
                  Annuler
                </button>
                {status === "recording" ? (
                  <button className="capture-btn primary capture-shutter recording" onClick={stopRecording}>
                    ⏹️
                  </button>
                ) : (
                  <button
                    className="capture-btn primary capture-shutter"
                    onClick={startRecording}
                    disabled={status !== "ready"}
                  >
                    ⏺️
                  </button>
                )}
                <span className="capture-hint">
                  {status === "recording" ? "Enregistrement..." : status === "ready" ? "Prêt" : "..."}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const CAPTURE_STYLES = `
  .capture-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    padding: 16px;
  }
  .capture-box {
    background: #1a1a1a;
    border-radius: 16px;
    overflow: hidden;
    max-width: 640px;
    width: 100%;
  }
  .capture-viewfinder {
    position: relative;
    aspect-ratio: 4/3;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .capture-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .capture-loading {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: #fff;
    font-size: 14px;
    background: rgba(0,0,0,0.5);
  }
  .spinner {
    width: 32px; height: 32px;
    border: 3px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .recording-indicator {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 13px;
    font-family: 'IBM Plex Mono', monospace;
  }
  .rec-dot {
    width: 10px; height: 10px;
    border-radius: 50%;
    background: #ff3b30;
    animation: pulse 1s ease-in-out infinite;
  }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  .capture-error {
    padding: 40px 24px;
    text-align: center;
    color: #ff3b30;
    font-size: 14px;
  }
  .capture-controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px 24px;
    background: #222;
  }
  .capture-btn {
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'Inter', sans-serif;
    transition: background 0.15s;
  }
  .capture-btn.primary {
    background: #534AB7;
    color: #fff;
  }
  .capture-btn.primary:hover { background: #443DB0; }
  .capture-btn.secondary {
    background: #444;
    color: #fff;
  }
  .capture-btn.secondary:hover { background: #555; }
  .capture-btn:disabled { opacity: 0.4; cursor: default; }
  .capture-shutter {
    width: 56px; height: 56px;
    border-radius: 50%;
    font-size: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .capture-shutter.recording {
    background: #ff3b30;
  }
  .capture-hint {
    color: #999;
    font-size: 12px;
  }
`;
