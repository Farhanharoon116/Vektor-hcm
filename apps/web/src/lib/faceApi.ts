import * as faceapi from '@vladmandic/face-api';
import {
  calculateEyeAspectRatio,
  FACE_MATCH_MAX_DISTANCE,
  calculateConfidenceFromDistance,
  computeMultiFrameDistance,
} from '@vektor/shared';

let modelsLoaded = false;
let modelsLoadingPromise: Promise<void> | null = null;

export async function loadFaceApiModels(): Promise<void> {
  if (modelsLoaded) return;
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    const modelPath = '/models';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
    ]);
    modelsLoaded = true;
  })();

  return modelsLoadingPromise;
}

export function isFaceApiModelsLoaded(): boolean {
  return modelsLoaded;
}

export interface LiveFaceDetectionResult {
  detected: boolean;
  score: number;
  box?: { x: number; y: number; width: number; height: number };
  descriptor?: Float32Array;
  leftEyeEar?: number;
  rightEyeEar?: number;
  avgEar?: number;
  hint: string;
  isStable: boolean;
}

/**
 * Single face detector with 68 landmarks & descriptor
 * Uses inputSize 416, scoreThreshold 0.5 as requested
 */
export async function detectFaceInVideo(
  video: HTMLVideoElement
): Promise<LiveFaceDetectionResult> {
  if (!modelsLoaded || !video || video.readyState < 2) {
    return {
      detected: false,
      score: 0,
      hint: 'Initializing camera & models...',
      isStable: false,
    };
  }

  try {
    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return {
        detected: false,
        score: 0,
        hint: 'Face the camera',
        isStable: false,
      };
    }

    const { box, score } = detection.detection;
    const landmarks = detection.landmarks;

    // Eye Aspect Ratio for 68 landmarks:
    // Left eye: indices 36 to 41
    // Right eye: indices 42 to 47
    const leftEye = landmarks.positions.slice(36, 42);
    const rightEye = landmarks.positions.slice(42, 48);

    const leftEyeEar = calculateEyeAspectRatio(leftEye);
    const rightEyeEar = calculateEyeAspectRatio(rightEye);
    const avgEar = +((leftEyeEar + rightEyeEar) / 2).toFixed(3);

    // Guidance hints based on detection box size and score
    const videoWidth = video.videoWidth || 640;
    const boxRatio = box.width / videoWidth;

    let hint = 'Hold still';
    let isStable = false;

    if (score < 0.70) {
      hint = 'More light needed';
    } else if (boxRatio < 0.22) {
      hint = 'Move closer';
    } else if (boxRatio > 0.75) {
      hint = 'Move slightly back';
    } else {
      hint = 'Face detected · Good position';
      isStable = true;
    }

    return {
      detected: true,
      score,
      box: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      descriptor: detection.descriptor,
      leftEyeEar,
      rightEyeEar,
      avgEar,
      hint,
      isStable,
    };
  } catch (err) {
    console.warn('Face detection error:', err);
    return {
      detected: false,
      score: 0,
      hint: 'Face the camera',
      isStable: false,
    };
  }
}

/**
 * Sample 5 frames 200ms apart from live video element (without mirrored canvas transformation)
 */
export async function sampleCheckInFrames(
  video: HTMLVideoElement,
  onProgress?: (sampledCount: number) => void
): Promise<{ descriptors: number[][]; avgScore: number }> {
  const descriptors: number[][] = [];
  let totalScore = 0;

  for (let i = 0; i < 5; i++) {
    const result = await detectFaceInVideo(video);
    if (result.detected && result.descriptor) {
      descriptors.push(Array.from(result.descriptor));
      totalScore += result.score;
      if (onProgress) onProgress(descriptors.length);
    }
    // Wait ~200ms between samples
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const avgScore = descriptors.length > 0 ? +(totalScore / descriptors.length).toFixed(3) : 0;
  return { descriptors, avgScore };
}

export { faceapi, FACE_MATCH_MAX_DISTANCE, calculateConfidenceFromDistance, computeMultiFrameDistance };
