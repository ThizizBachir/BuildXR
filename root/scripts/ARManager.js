// Minimal AR manager that waits for OpenCV and the camera, then runs a simple CV pipeline.
// Keeps things non-blocking so your existing drone/model code in main.js can run unchanged.

import './opencv/opencv-loader.js';
import './camera/CameraCapture.js';

async function initAR() {
  try {
    const cv = await window.cvReady;
    const { canvas } = await window.CameraCapture.start();

    // create a processing canvas for OpenCV (we will draw processed result onto cameraCanvas)
    const src = new cv.Mat();
    const gray = new cv.Mat();
    const dst = new cv.Mat();

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const ctx = canvas.getContext('2d');

    function processFrame() {
      try {
        // read pixels from the visible canvas into cv.Mat
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        src.data.set(imageData.data);
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        // optional: apply Canny edges for a simple effect
        cv.Canny(gray, dst, 50, 150);
        // convert edges to RGBA for display
        cv.cvtColor(dst, src, cv.COLOR_GRAY2RGBA);
        // write back to canvas
        const out = new ImageData(new Uint8ClampedArray(src.data), canvasWidth, canvasHeight);
        ctx.putImageData(out, 0, 0);
      } catch (e) {
        // CPU expensive: fail silently to avoid halting
        console.warn('AR processing error', e);
      }
      requestAnimationFrame(processFrame);
    }

    // initialize mats with correct size and type
    src.create(canvasHeight, canvasWidth, cv.CV_8UC4);
    gray.create(canvasHeight, canvasWidth, cv.CV_8UC1);
    dst.create(canvasHeight, canvasWidth, cv.CV_8UC1);

    requestAnimationFrame(processFrame);

    // expose stop hook
    window.AR = {
      stop: () => {
        src.delete(); gray.delete(); dst.delete();
        window.CameraCapture.stop();
      }
    };

    console.log('ARManager initialized');
  } catch (err) {
    console.error('Failed to initialize ARManager', err);
  }
}

// auto-init but safely (non-blocking)
initAR();

export { initAR };