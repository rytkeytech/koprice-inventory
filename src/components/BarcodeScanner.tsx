"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Minimal types for the browser BarcodeDetector API (Chrome on Android).
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];

type Props = {
  onDetected: (code: string) => void;
  onClose: () => void;
};

/**
 * Full-screen camera scanner. Uses the phone's built-in BarcodeDetector when
 * available, otherwise the ZXing library (loaded only when needed).
 */
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string>();
  const detectedRef = useRef(onDetected);

  useEffect(() => {
    detectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | undefined;
    let timer: number | undefined;
    let stopZxing: (() => void) | undefined;
    let lastCode = "";

    const found = (code: string) => {
      if (stopped || !code || code === lastCode) return;
      lastCode = code;
      navigator.vibrate?.(60);
      detectedRef.current(code);
    };

    async function start() {
      const video = videoRef.current;
      if (!video) return;
      try {
        const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        if (Detector) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (stopped) return;
          video.srcObject = stream;
          await video.play();
          const detector = new Detector({ formats: FORMATS });
          const scan = async () => {
            if (stopped) return;
            try {
              const codes = await detector.detect(video);
              if (codes[0]) found(codes[0].rawValue);
            } catch {
              // A frame that can't be read; keep scanning.
            }
            timer = window.setTimeout(scan, 250);
          };
          scan();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints(
            { video: { facingMode: "environment" }, audio: false },
            video,
            (result) => {
              if (result) found(result.getText());
            },
          );
          stopZxing = () => controls.stop();
          if (stopped) stopZxing();
        }
      } catch {
        setError("Could not open the camera. Allow camera access, or type the barcode instead.");
      }
    }

    start();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      stopZxing?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div role="dialog" aria-modal="true" aria-label="Scan barcode" className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between p-3 text-white">
        <p className="font-semibold">Point the camera at the barcode</p>
        <button type="button" onClick={onClose} aria-label="Close scanner" className="flex size-12 items-center justify-center rounded-full bg-white/15">
          <X aria-hidden="true" className="size-6" />
        </button>
      </div>
      <div className="relative flex-1">
        <video ref={videoRef} className="absolute inset-0 size-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-40 -translate-y-1/2 rounded-card border-4 border-accent/90" />
      </div>
      {error && <p className="bg-danger p-4 text-center text-white">{error}</p>}
    </div>
  );
}
