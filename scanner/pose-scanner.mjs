const SOURCE = 'mph-auto-trace-page';
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304';
const HEAVY_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';
const FULL_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task';

let landmarkerPromise = null;
window.postMessage({ source: SOURCE, type: 'MPH_SCANNER_BOOTED' }, '*');

window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  const message = event.data;
  if (!message || message.source !== 'mph-auto-trace-extension' || message.type !== 'MPH_SCAN_REFERENCE') return;

  try {
    const landmarker = await ensureLandmarker();
    const image = await decodeImage(message.dataUrl);
    const result = landmarker.detect(image);
    const landmarks = result?.landmarks?.[0];
    if (!landmarks?.length) throw new Error('No person pose found.');

    window.postMessage({
      source: SOURCE,
      type: 'MPH_SCAN_RESULT',
      requestId: message.requestId,
      landmarks,
      worldLandmarks: result?.worldLandmarks?.[0] || null
    }, '*');
  } catch (error) {
    window.postMessage({
      source: SOURCE,
      type: 'MPH_SCAN_ERROR',
      requestId: message.requestId,
      message: error?.message || String(error)
    }, '*');
  }
});

async function ensureLandmarker() {
  if (!landmarkerPromise) landmarkerPromise = createLandmarker();
  return landmarkerPromise;
}

async function createLandmarker() {
  const module = await import(`${CDN}/vision_bundle.mjs`);
  const api = module.default || module;
  const { FilesetResolver, PoseLandmarker } = api;
  if (!FilesetResolver || !PoseLandmarker) throw new Error('MediaPipe Pose failed to load.');

  const vision = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const common = {
    runningMode: 'IMAGE',
    numPoses: 1,
    minPoseDetectionConfidence: 0.35,
    minPosePresenceConfidence: 0.35,
    minTrackingConfidence: 0.35,
    outputSegmentationMasks: false
  };

  const attempts = [
    { modelAssetPath: HEAVY_MODEL, delegate: 'GPU' },
    { modelAssetPath: HEAVY_MODEL, delegate: 'CPU' },
    { modelAssetPath: FULL_MODEL, delegate: 'CPU' }
  ];

  let lastError;
  for (const baseOptions of attempts) {
    try {
      return await PoseLandmarker.createFromOptions(vision, { ...common, baseOptions });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Pose scanner failed to initialize.');
}

function decodeImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not decode the reference image.'));
    image.src = dataUrl;
  });
}
