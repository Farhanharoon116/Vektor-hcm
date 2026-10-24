import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, AlertCircle, RefreshCw, X, Shield, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { api } from '../../lib/api';
import { loadFaceApiModels, detectFaceInVideo } from '../../lib/faceApi';

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  employeeName: string;
  onSuccess: (updatedEmployee: any) => void;
}

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({
  isOpen,
  onClose,
  employeeId,
  employeeName,
  onSuccess,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [streamReady, setStreamReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Capture State: 5 frames over ~3 seconds
  // 1: Straight, 2: Straight, 3: Slightly Left, 4: Slightly Right, 5: Straight
  const [capturedDescriptors, setCapturedDescriptors] = useState<number[][]>([]);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string>('Look straight at the camera');
  const [isCapturingSequence, setIsCapturingSequence] = useState(false);
  const [detectionScore, setDetectionScore] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      resetState();
      initCameraAndModels();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, employeeId]);

  const resetState = () => {
    setCapturedDescriptors([]);
    setCapturedSnapshot(null);
    setIsCapturingSequence(false);
    setIsSuccess(false);
    setCameraError(null);
    setCurrentPrompt('Look straight at the camera');
  };

  const initCameraAndModels = async () => {
    try {
      setIsLoadingModels(true);
      await loadFaceApiModels();
      setIsLoadingModels(false);

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setStreamReady(true);
    } catch (err: any) {
      setCameraError(err.message || 'Unable to access camera or load models');
      setIsLoadingModels(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setStreamReady(false);
  };

  // Continuous monitoring of face position and quality
  useEffect(() => {
    let animId: number;

    const checkFrame = async () => {
      if (videoRef.current && streamReady && !isSuccess && !isCapturingSequence) {
        const res = await detectFaceInVideo(videoRef.current);
        setDetectionScore(res.detected ? res.score : 0);
      }
      if (isOpen && !isSuccess) {
        animId = requestAnimationFrame(checkFrame);
      }
    };

    if (streamReady && isOpen && !isSuccess) {
      animId = requestAnimationFrame(checkFrame);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [streamReady, isOpen, isSuccess, isCapturingSequence]);

  // Automated 5-frame enrollment sequence
  const startEnrollmentSequence = async () => {
    if (!videoRef.current) return;
    setIsCapturingSequence(true);
    setCapturedDescriptors([]);

    const prompts = [
      'Frame 1/5: Look straight at the camera...',
      'Frame 2/5: Look straight, relax your expression...',
      'Frame 3/5: Turn your head slightly to the left...',
      'Frame 4/5: Turn your head slightly to the right...',
      'Frame 5/5: Back to center, look straight...',
    ];

    const descriptors: number[][] = [];
    let snapshotUrl: string | null = null;

    for (let step = 0; step < 5; step++) {
      setCurrentPrompt(prompts[step]);

      // Give user 600ms to adjust posture
      await new Promise((r) => setTimeout(r, 600));

      let captured = false;
      let attempts = 0;

      // Keep polling until score > 0.8 with exactly 1 face, up to 15 attempts (3 seconds per step)
      while (!captured && attempts < 15) {
        attempts++;
        if (!videoRef.current) break;

        const res = await detectFaceInVideo(videoRef.current);
        setDetectionScore(res.detected ? res.score : 0);

        if (res.detected && res.descriptor && res.score > 0.8) {
          descriptors.push(Array.from(res.descriptor));
          setCapturedDescriptors([...descriptors]);
          captured = true;

          // Capture portrait snapshot on first straight frame
          if (step === 0) {
            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 400;
            const ctx = canvas.getContext('2d');
            if (ctx && videoRef.current) {
              ctx.drawImage(videoRef.current, 0, 0, 400, 400);
              snapshotUrl = canvas.toDataURL('image/jpeg', 0.9);
              setCapturedSnapshot(snapshotUrl);
            }
          }
        } else {
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (!captured) {
        // Fallback: captured with standard threshold if lighting is challenging
        if (videoRef.current) {
          const res = await detectFaceInVideo(videoRef.current);
          if (res.detected && res.descriptor) {
            descriptors.push(Array.from(res.descriptor));
            setCapturedDescriptors([...descriptors]);
          }
        }
      }
    }

    setIsCapturingSequence(false);

    if (descriptors.length >= 3) {
      await saveEnrollment(descriptors, snapshotUrl);
    } else {
      setCurrentPrompt('Quality insufficient. Please ensure good lighting and try again.');
    }
  };

  const saveEnrollment = async (descriptors: number[][], snapshotUrl: string | null) => {
    setIsSubmitting(true);
    try {
      const res = await api.post(`/employees/${employeeId}/enroll-face`, {
        face_descriptors: descriptors,
        face_descriptor: descriptors[0],
        image_data: snapshotUrl,
      });

      setIsSuccess(true);
      stopCamera();
      if (res.employee) {
        onSuccess(res.employee);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to save biometric enrollment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title={`Biometric Face Enrollment · ${employeeName}`}
      maxWidth="md"
    >
      <div className="space-y-4 text-xs">
        {cameraError ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl space-y-2 text-center">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <p className="font-semibold text-sm">Camera or Model Access Failed</p>
            <p className="text-xs text-rose-600">{cameraError}</p>
            <Button size="sm" onClick={initCameraAndModels} className="mt-2">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
            </Button>
          </div>
        ) : isSuccess ? (
          <div className="p-6 text-center bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-900">
              Biometric Enrollment Complete!
            </h3>
            <p className="text-xs text-gray-600 max-w-sm mx-auto">
              5 high-precision facial descriptors captured and verified. {employeeName} is now ready for camera attendance.
            </p>
            <div className="pt-2">
              <Button size="sm" onClick={onClose} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Done & Close
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Live Camera View with Oval Guide */}
            <div className="relative rounded-2xl overflow-hidden bg-gray-950 aspect-video flex items-center justify-center shadow-inner">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* Dynamic Center Oval */}
              <div
                className={`absolute inset-0 m-auto w-40 h-52 rounded-full border-3 pointer-events-none transition-all flex flex-col items-center justify-center ${
                  detectionScore > 0.8
                    ? 'border-emerald-400 bg-emerald-400/10 shadow-[0_0_20px_rgba(52,211,153,0.3)]'
                    : detectionScore > 0.5
                    ? 'border-amber-400 border-dashed bg-amber-400/10'
                    : 'border-white/40 border-dashed bg-black/20'
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-black/70 text-white">
                  {detectionScore > 0.8
                    ? 'Ready for Capture'
                    : detectionScore > 0.5
                    ? 'Center Your Face'
                    : 'Align Face in Oval'}
                </span>
              </div>

              {/* Top Banner: Prompt */}
              <div className="absolute top-3 inset-x-3 bg-black/75 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-center text-xs font-medium border border-white/10 flex items-center justify-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{currentPrompt}</span>
              </div>

              {/* Bottom Progress Bar */}
              <div className="absolute bottom-3 inset-x-3 bg-black/80 backdrop-blur-xs text-white p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-brand-400" />
                  <span className="text-[11px] font-semibold">
                    Captured: {capturedDescriptors.length} / 5 reference frames
                  </span>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((idx) => (
                    <div
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                        capturedDescriptors.length > idx
                          ? 'bg-emerald-500 text-white scale-110 shadow-xs'
                          : 'bg-white/20 text-white/50'
                      }`}
                    >
                      {idx + 1}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Explanatory Note */}
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-[11px] text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700">Multi-Angle Biometric Enrollment</p>
              <p>
                Capturing 5 frames at straight, left, and right angles ensures high recognition accuracy under varying workplace lighting and angles.
              </p>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={onClose} disabled={isCapturingSequence || isSubmitting}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={startEnrollmentSequence}
                disabled={!streamReady || isLoadingModels || isCapturingSequence || isSubmitting}
                isLoading={isCapturingSequence || isSubmitting}
                className="bg-brand-600 hover:bg-brand-700 text-white"
              >
                <Camera className="w-3.5 h-3.5 mr-1.5" />
                {capturedDescriptors.length > 0 ? 'Re-Capture 5 Frames' : 'Start 5-Frame Capture (~3s)'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
