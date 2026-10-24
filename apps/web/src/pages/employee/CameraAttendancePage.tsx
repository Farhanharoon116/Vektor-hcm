import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  User,
  Upload,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Lock,
  XCircle,
  Eye,
  Activity,
  FileEdit,
  Globe,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  loadFaceApiModels,
  detectFaceInVideo,
  sampleCheckInFrames,
  FACE_MATCH_MAX_DISTANCE,
  calculateConfidenceFromDistance,
  computeMultiFrameDistance,
} from '../../lib/faceApi';
import { FaceEnrollmentModal } from '../../components/biometrics/FaceEnrollmentModal';

export const CameraAttendancePage: React.FC = () => {
  const { user, employee: storeEmployee, updateEmployee } = useAuthStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const navigate = useNavigate();

  const empId = user?.employee_id || storeEmployee?.id;

  // Camera & Stream
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(true);

  // Enrolled Reference Data
  const [enrolledPhoto, setEnrolledPhoto] = useState<string | null>(null);
  const [enrolledName, setEnrolledName] = useState<string>('');
  const [enrolledDescriptors, setEnrolledDescriptors] = useState<number[][]>([]);
  const [requireFaceMatchSetting, setRequireFaceMatchSetting] = useState<boolean>(true);
  const [maxDistanceSetting, setMaxDistanceSetting] = useState<number>(FACE_MATCH_MAX_DISTANCE);

  // Live Matching & Liveness States
  const [rawDistance, setRawDistance] = useState<number | null>(null);
  const [uiConfidence, setUiConfidence] = useState<number>(0);
  const [isFaceMatched, setIsFaceMatched] = useState<boolean>(false);
  const [liveHint, setLiveHint] = useState<string>('Initializing biometric scanner...');
  const [detectionScore, setDetectionScore] = useState<number>(0);
  const [isStable, setIsStable] = useState<boolean>(false);

  // Blink Liveness (EAR < 0.20 then > 0.25 within 5 seconds)
  const [blinkDetected, setBlinkDetected] = useState<boolean>(false);
  const [blinkExpiryTimer, setBlinkExpiryTimer] = useState<number | null>(null);
  const earHistoryRef = useRef<number[]>([]);
  const lastBlinkTimeRef = useRef<number>(0);

  // 3-second auto-capture countdown when face is stable + matched + blink passed
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
  const autoCaptureTimerRef = useRef<any>(null);

  // Sampling & Submission State
  const [isSampling, setIsSampling] = useState<boolean>(false);
  const [sampledCount, setSampledCount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);
  const [serverError, setServerError] = useState<{ message: string; code?: string } | null>(null);

  // Location State
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);

  // Modals & Accordions
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  useEffect(() => {
    loadModelsAndSettings();
    loadEmployeeProfile();
    fetchLocation();

    return () => {
      stopCamera();
      if (autoCaptureTimerRef.current) clearInterval(autoCaptureTimerRef.current);
    };
  }, [empId]);

  const loadModelsAndSettings = async () => {
    try {
      setModelsLoading(true);
      await loadFaceApiModels();
      setModelsLoaded(true);

      // Fetch company settings for face matching threshold
      const res = await api.get('/company/settings').catch(() => null);
      if (res?.settings) {
        if (res.settings.face_match_max_distance) {
          setMaxDistanceSetting(Number(res.settings.face_match_max_distance));
        }
        if (res.settings.require_face_match !== undefined) {
          setRequireFaceMatchSetting(Boolean(res.settings.require_face_match));
        }
      }
    } catch (err) {
      console.error('Failed to load face-api models or settings', err);
    } finally {
      setModelsLoading(false);
    }
  };

  const loadEmployeeProfile = async () => {
    if (!empId) return;
    try {
      const res = await api.get(`/employees/${empId}`);
      if (res.employee) {
        setEnrolledName(`${res.employee.first_name} ${res.employee.last_name}`);
        const photo =
          res.employee.face_descriptor?.photo_url ||
          (typeof res.employee.face_descriptor === 'string' ? res.employee.face_descriptor : null);
        setEnrolledPhoto(photo);

        // Extract 5 descriptors or single descriptor
        const descs: number[][] = [];
        if (res.employee.face_descriptors && Array.isArray(res.employee.face_descriptors)) {
          if (Array.isArray(res.employee.face_descriptors[0])) {
            descs.push(...res.employee.face_descriptors);
          } else {
            descs.push(res.employee.face_descriptors);
          }
        } else if (res.employee.face_descriptor) {
          if (Array.isArray(res.employee.face_descriptor)) {
            descs.push(res.employee.face_descriptor);
          } else if (
            res.employee.face_descriptor.descriptors &&
            Array.isArray(res.employee.face_descriptor.descriptors)
          ) {
            descs.push(...res.employee.face_descriptor.descriptors);
          } else if (
            res.employee.face_descriptor.descriptor &&
            Array.isArray(res.employee.face_descriptor.descriptor)
          ) {
            descs.push(res.employee.face_descriptor.descriptor);
          }
        }

        setEnrolledDescriptors(descs);
        updateEmployee(res.employee);
      }
    } catch (err) {
      console.error('Failed to load profile for biometric reference', err);
    }
  };

  // Start camera when models are ready
  useEffect(() => {
    if (modelsLoaded && !stream && !result) {
      startCamera();
    }
  }, [modelsLoaded, result]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setServerError({
        message: 'Unable to access camera: ' + err.message,
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Browser Geolocation Acquisition
  const fetchLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationAccuracy(Math.round(pos.coords.accuracy));
      },
      () => {
        // Fallback default coordinates
        setLocation({ lat: 24.8607, lng: 67.0011 });
        setLocationAccuracy(25);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Continuous frame analysis loop
  useEffect(() => {
    let animId: number;
    let isProcessing = false;

    const processFrame = async () => {
      if (
        videoRef.current &&
        stream &&
        modelsLoaded &&
        !isSampling &&
        !isSubmitting &&
        !result
      ) {
        if (!isProcessing) {
          isProcessing = true;
          try {
            await analyzeLiveFrame();
          } catch (e) {
            console.warn('Frame analysis skipped:', e);
          } finally {
            isProcessing = false;
          }
        }
      }

      if (stream && !result) {
        animId = requestAnimationFrame(processFrame);
      }
    };

    if (stream && modelsLoaded && !result) {
      animId = requestAnimationFrame(processFrame);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [stream, modelsLoaded, enrolledDescriptors, isSampling, isSubmitting, result, blinkDetected]);

  /**
   * Evaluates single video frame:
   * 1. Detect face directly from <video> (never from mirrored canvas)
   * 2. Check blink liveness (EAR < 0.20 -> EAR > 0.25)
   * 3. Compute Euclidean distance to stored descriptors
   * 4. Update hints and confidence
   */
  const analyzeLiveFrame = async () => {
    if (!videoRef.current) return;

    const res = await detectFaceInVideo(videoRef.current);
    setDetectionScore(res.score);
    setIsStable(res.isStable);

    if (!res.detected || !res.descriptor) {
      setIsFaceMatched(false);
      setLiveHint(res.hint || 'Position face inside the oval');
      return;
    }

    // 1. Blink Liveness Check (EAR)
    if (res.avgEar !== undefined) {
      const ear = res.avgEar;
      earHistoryRef.current.push(ear);
      if (earHistoryRef.current.length > 10) earHistoryRef.current.shift();

      // Check if EAR dropped below 0.20 in recent frames and is currently above 0.25
      const hasDrop = earHistoryRef.current.slice(0, -2).some((val) => val < 0.20);
      const isRecovered = ear > 0.25;

      if (hasDrop && isRecovered) {
        const now = Date.now();
        lastBlinkTimeRef.current = now;
        setBlinkDetected(true);

        // Blink validity lasts 5 seconds
        if (blinkExpiryTimer) clearTimeout(blinkExpiryTimer);
        const timer: any = setTimeout(() => {
          setBlinkDetected(false);
        }, 5000);
        setBlinkExpiryTimer(timer);
      }
    }

    // 2. Euclidean Distance Calculation against all stored descriptors
    if (enrolledDescriptors.length > 0) {
      const liveDesc = Array.from(res.descriptor);
      const dist = computeMultiFrameDistance([liveDesc], enrolledDescriptors);
      setRawDistance(dist);

      // Match decided on distance < maxDistanceSetting (0.55 default)
      const matched = dist < maxDistanceSetting;
      setIsFaceMatched(matched);

      // UI friendly confidence
      const conf = calculateConfidenceFromDistance(dist);
      setUiConfidence(conf);

      if (matched) {
        setLiveHint(
          blinkDetected
            ? `Identity verified · 1-to-1 match with ${enrolledName}`
            : 'Please blink once to verify liveness'
        );
      } else {
        setLiveHint(
          `Face mismatch (distance: ${dist.toFixed(3)}, req < ${maxDistanceSetting})`
        );
      }
    } else {
      // Unenrolled employee
      setIsFaceMatched(!requireFaceMatchSetting);
      setLiveHint(
        requireFaceMatchSetting
          ? 'Biometric enrollment required. Click Re-Enroll to register.'
          : 'Face detected (Enrollment optional)'
      );
    }
  };

  // 3-Second Auto-Capture trigger when face is stable + matched + blink detected
  useEffect(() => {
    const isReadyForAutoCapture =
      isFaceMatched &&
      (blinkDetected || enrolledDescriptors.length === 0) &&
      isStable &&
      !isSampling &&
      !isSubmitting &&
      !result;

    if (isReadyForAutoCapture) {
      if (autoCaptureCountdown === null) {
        setAutoCaptureCountdown(3);
      }
    } else {
      if (autoCaptureCountdown !== null) {
        setAutoCaptureCountdown(null);
        if (autoCaptureTimerRef.current) clearInterval(autoCaptureTimerRef.current);
      }
    }
  }, [isFaceMatched, blinkDetected, isStable, isSampling, isSubmitting, result]);

  // Handle countdown tick
  useEffect(() => {
    if (autoCaptureCountdown !== null) {
      if (autoCaptureCountdown > 1) {
        const timer = setTimeout(() => {
          setAutoCaptureCountdown((prev) => (prev !== null ? prev - 1 : null));
        }, 1000);
        return () => clearTimeout(timer);
      } else if (autoCaptureCountdown === 1) {
        const timer = setTimeout(() => {
          setAutoCaptureCountdown(null);
          handleCheckIn();
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [autoCaptureCountdown]);

  /**
   * 5-Frame Check-In Submission:
   * 1. Samples ~5 frames (200ms apart)
   * 2. Computes Euclidean distance against stored descriptors
   * 3. Sends descriptors and GPS to server
   * 4. Server makes definitive verification decision
   */
  const handleCheckIn = async () => {
    if (!videoRef.current || isSubmitting || isSampling) return;
    setServerError(null);
    setIsSampling(true);
    setSampledCount(0);

    try {
      // Sample 5 frames 200ms apart directly from <video> element
      const { descriptors: liveFrames, avgScore } = await sampleCheckInFrames(
        videoRef.current,
        (count) => setSampledCount(count)
      );

      setIsSampling(false);
      setIsSubmitting(true);

      const payload = {
        source: 'camera',
        latitude: location?.lat,
        longitude: location?.lng,
        accuracy: locationAccuracy || 20,
        face_detected: liveFrames.length > 0,
        face_count: liveFrames.length > 0 ? 1 : 0,
        face_descriptors: liveFrames,
        face_descriptor: liveFrames[0] || null,
        notes: `Checked in via camera biometric verification (${liveFrames.length} frames sampled, score: ${avgScore})`,
      };

      const res = await api.post('/attendance/check-in', payload);
      setResult(res);
      stopCamera();
    } catch (err: any) {
      const serverCode = err.code || err.data?.code;
      const message = err.message || err.error || 'Check-in failed';
      setServerError({ message, code: serverCode });
    } finally {
      setIsSampling(false);
      setIsSubmitting(false);
    }
  };

  /**
   * Fallback: Web Check-In without Camera
   */
  const handleFallbackWebCheckIn = async () => {
    if (isSubmitting) return;
    setServerError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post('/attendance/check-in', {
        source: 'web',
        latitude: location?.lat,
        longitude: location?.lng,
        accuracy: locationAccuracy || 20,
        notes: 'Fallback check-in without camera biometric verification',
      });
      setResult(res);
      stopCamera();
    } catch (err: any) {
      setServerError({ message: err.message || 'Web check-in failed' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnrollSuccess = (updatedEmployee: any) => {
    setIsEnrollModalOpen(false);
    loadEmployeeProfile();
  };

  const canCheckIn =
    !isSubmitting &&
    !isSampling &&
    modelsLoaded &&
    isFaceMatched &&
    (blinkDetected || enrolledDescriptors.length === 0);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/employee')}
          className="inline-flex items-center text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </button>
        <div className="flex items-center gap-2">
          <Badge variant={isFaceMatched ? 'success' : 'neutral'}>
            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
            {isFaceMatched ? 'Biometric Match' : 'Biometric Attendance'}
          </Badge>
        </div>
      </div>

      {/* Success View */}
      {result ? (
        <Card className="p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Attendance Marked!</h2>
            <p className="text-xs text-gray-500 mt-1">
              Your biometric verification and location check were confirmed by the server.
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 max-w-sm mx-auto text-left space-y-2 border border-gray-100 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Employee:</span>
              <span className="font-semibold text-gray-900">{enrolledName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Clock In Time:</span>
              <span className="font-semibold text-gray-900">
                {new Date(result.attendance.clock_in).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status:</span>
              <Badge variant={result.is_late ? 'warning' : 'success'}>
                {result.is_late ? 'Late Arrival' : 'On Time'}
              </Badge>
            </div>
            {result.face_match_distance !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">Biometric Distance:</span>
                <span className="font-mono font-semibold text-emerald-700">
                  {Number(result.face_match_distance).toFixed(4)} (Accept)
                </span>
              </div>
            )}
            {result.distance_meters !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">Office Distance:</span>
                <span className="font-mono text-gray-700">{result.distance_meters}m</span>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <Button onClick={() => navigate('/employee')}>Return to Dashboard</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-6 space-y-4">
          {/* Enrolled Reference Header */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-3">
              {enrolledPhoto ? (
                <img
                  src={enrolledPhoto}
                  alt="Enrolled Face"
                  className="w-11 h-11 rounded-xl object-cover border-2 border-brand-500 shadow-xs"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm">
                  <User className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-gray-900">
                    {enrolledName || 'Employee Face Record'}
                  </h4>
                  {enrolledDescriptors.length > 0 ? (
                    <Badge variant="success" className="text-[10px]">
                      {enrolledDescriptors.length} Frames Enrolled
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="text-[10px]">
                      Not Enrolled
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">
                  {enrolledDescriptors.length > 0
                    ? 'Neural 128-d Euclidean distance matching'
                    : 'Camera attendance requires live facial enrollment'}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsEnrollModalOpen(true)}
              className="text-[11px]"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              {enrolledDescriptors.length > 0 ? 'Re-Enroll Face' : 'Enroll Now'}
            </Button>
          </div>

          {/* Camera Video Stream Container */}
          <div className="relative rounded-2xl overflow-hidden bg-gray-950 aspect-video flex items-center justify-center shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Dynamic Center Oval Guide */}
            <div
              className={`absolute inset-0 m-auto w-48 h-64 rounded-full border-3 pointer-events-none transition-all duration-200 flex flex-col items-center justify-center ${
                isFaceMatched
                  ? 'border-emerald-400 bg-emerald-400/10 shadow-[0_0_30px_rgba(52,211,153,0.35)]'
                  : rawDistance !== null
                  ? 'border-amber-400 border-dashed bg-amber-500/10'
                  : 'border-rose-400/80 border-dashed bg-rose-500/10'
              }`}
            >
              <div
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-xs transition-colors ${
                  isFaceMatched
                    ? 'bg-emerald-600 text-white'
                    : rawDistance !== null
                    ? 'bg-amber-600 text-white'
                    : 'bg-rose-600 text-white animate-pulse'
                }`}
              >
                {isFaceMatched
                  ? '✓ Face Matched'
                  : rawDistance !== null
                  ? '❌ Face Mismatch'
                  : 'Align Face in Oval'}
              </div>

              {rawDistance !== null && (
                <div className="mt-1 bg-black/75 px-2.5 py-0.5 rounded-full flex items-center gap-1.5 font-mono text-[10px] text-white">
                  <span>Confidence: {uiConfidence.toFixed(0)}%</span>
                  <span className="text-white/40">·</span>
                  <span className={isFaceMatched ? 'text-emerald-300' : 'text-amber-300'}>
                    {isFaceMatched ? 'Match' : 'No match'}
                  </span>
                </div>
              )}
            </div>

            {/* Top-Right Liveness Badge (Blink Detection) */}
            <div className="absolute top-3 right-3 bg-black/75 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 border border-white/10 shadow-sm">
              <Eye
                className={`w-3.5 h-3.5 ${
                  blinkDetected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'
                }`}
              />
              <span className="text-[11px] font-semibold">
                {blinkDetected ? '✓ Blink Verified (Live)' : 'Blink Eyes for Liveness'}
              </span>
            </div>

            {/* Top-Left Live Guidance Hint */}
            <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 border border-white/10 shadow-sm">
              <Activity className="w-3.5 h-3.5 text-brand-400" />
              <span className="text-[11px] font-medium">{liveHint}</span>
            </div>

            {/* Bottom-Left GPS Location Badge */}
            <div className="absolute bottom-3 left-3 bg-black/75 backdrop-blur-xs text-white px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-2 border border-white/10 shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-brand-400" />
              <span>
                {location
                  ? `GPS: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)} (±${locationAccuracy || 20}m)`
                  : 'Acquiring GPS coordinates...'}
              </span>
            </div>

            {/* Bottom-Right Auto-Capture Overlay */}
            {autoCaptureCountdown !== null && (
              <div className="absolute bottom-3 right-3 bg-emerald-600/90 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-bounce">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Auto-Capturing in {autoCaptureCountdown}s...</span>
              </div>
            )}
          </div>

          {/* Bottom Error / Warning Banner - Line Wrapping Allowed (Fix #6) */}
          {serverError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 whitespace-normal">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">
                  {serverError.code === 'NOT_ENROLLED'
                    ? 'Biometric Profile Not Enrolled'
                    : serverError.code === 'FACE_MISMATCH'
                    ? 'Biometric Mismatch'
                    : serverError.code === 'OUTSIDE_RADIUS'
                    ? 'Outside Office Geofence'
                    : serverError.code === 'GPS_ACCURACY'
                    ? 'Low GPS Accuracy'
                    : serverError.code === 'FACE_COUNT'
                    ? 'Face Detection Error'
                    : 'Check-In Rejected'}
                </p>
                <p className="text-rose-700 leading-relaxed">{serverError.message}</p>
                {serverError.code === 'NOT_ENROLLED' && (
                  <Button
                    size="sm"
                    onClick={() => setIsEnrollModalOpen(true)}
                    className="mt-1 bg-rose-600 hover:bg-rose-700 text-white"
                  >
                    Enroll Biometric Face Now
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-gray-100">
            <div className="text-xs text-gray-500 space-y-0.5 text-center sm:text-left">
              <p className="font-semibold text-gray-800">
                Biometric & Geofence Verification Status
              </p>
              <p className="text-[11px]">
                {canCheckIn
                  ? `Identity confirmed for ${enrolledName}. Ready to mark attendance.`
                  : isFaceMatched && !blinkDetected
                  ? 'Face matched. Please blink your eyes once to verify liveness.'
                  : rawDistance !== null
                  ? 'Face does not match enrolled profile. Center face in frame.'
                  : 'Position your face directly in the oval to begin.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFallbackWebCheckIn}
                disabled={isSubmitting || isSampling}
                className="text-[11px]"
                title="Mark attendance without camera check"
              >
                <Globe className="w-3.5 h-3.5 mr-1" /> Check In without Camera
              </Button>

              <Button
                onClick={handleCheckIn}
                disabled={!canCheckIn}
                isLoading={isSubmitting || isSampling}
                size="md"
                className={
                  canCheckIn
                    ? 'bg-brand-600 hover:bg-brand-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }
              >
                <Camera className="w-4 h-4 mr-1.5" />
                {isSampling
                  ? `Sampling Frames (${sampledCount}/5)...`
                  : canCheckIn
                  ? 'Verify Face & Check-In'
                  : 'Align & Blink to Enable'}
              </Button>
            </div>
          </div>

          {/* Fallback Correction Request Link */}
          <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
            <span>Having issues with camera or location?</span>
            <button
              onClick={() => navigate('/employee/attendance')}
              className="text-brand-600 hover:text-brand-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <FileEdit className="w-3 h-3" /> Request Attendance Correction
            </button>
          </div>

          {/* Development Debug Panel (Visible only in development, Fix #8) */}
          {Boolean((import.meta as any).env?.DEV) && (
            <div className="p-3 bg-gray-900 text-gray-200 rounded-xl font-mono text-[11px] space-y-1 border border-gray-800">
              <div className="flex items-center justify-between font-bold text-amber-400 border-b border-gray-800 pb-1">
                <span>🛠️ DEV BIOMETRIC DEBUG PANEL</span>
                <span className="text-[10px] text-gray-400 font-normal">import.meta.env.DEV</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[10px]">
                <div>
                  <span className="text-gray-400">Raw Distance:</span>
                  <p className="font-bold text-white">
                    {rawDistance !== null ? rawDistance.toFixed(4) : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Threshold:</span>
                  <p className="font-bold text-white">&lt; {maxDistanceSetting}</p>
                </div>
                <div>
                  <span className="text-gray-400">Detection Score:</span>
                  <p className="font-bold text-white">{detectionScore.toFixed(3)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Blink Liveness:</span>
                  <p className={blinkDetected ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {blinkDetected ? 'Passed' : 'Pending'}
                  </p>
                </div>
              </div>
              <div className="text-[10px] text-gray-400 pt-1 flex justify-between">
                <span>Stored Descriptors: {enrolledDescriptors.length}</span>
                <span>Rule: distance &lt; {maxDistanceSetting} = {isFaceMatched ? 'MATCH' : 'MISMATCH'}</span>
              </div>
            </div>
          )}

          {/* Explanatory Breakdown: Storage & Biometric Matching */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHowItWorks(!showHowItWorks)}
              className="w-full bg-gray-50 px-4 py-3 flex items-center justify-between text-left cursor-pointer hover:bg-gray-100/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold text-gray-900">
                  How Face Recognition & Liveness Work
                </span>
              </div>
              {showHowItWorks ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showHowItWorks && (
              <div className="p-4 bg-white text-xs text-gray-600 space-y-3">
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Euclidean Distance vs Percentage Rule
                  </h4>
                  <p>
                    Biometric matching uses neural 128-dimensional facial embeddings. Match decisions are made on Euclidean distance (&lt; 0.55), avoiding arbitrary percentage thresholds. Multiple live frames are sampled and compared against all stored employee profiles.
                  </p>
                </div>

                <div className="space-y-1 pt-2 border-t border-gray-100">
                  <h4 className="font-bold text-gray-900 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-brand-600" /> Blink Liveness Verification
                  </h4>
                  <p>
                    To prevent spoofing with a printed photograph or screen replay, the system calculates the Eye Aspect Ratio (EAR) across 68 facial landmarks, requiring a natural eye blink before authorizing attendance.
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Face Enrollment Modal */}
      {empId && (
        <FaceEnrollmentModal
          isOpen={isEnrollModalOpen}
          onClose={() => setIsEnrollModalOpen(false)}
          employeeId={empId}
          employeeName={enrolledName || 'Employee'}
          onSuccess={handleEnrollSuccess}
        />
      )}
    </div>
  );
};
