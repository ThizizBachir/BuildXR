// scripts/opencv/GestureDetector.js
// Swipe-gesture detector using OpenCV.js + dense optical flow (Farnebäck).
// Emits:
//   - 'gesture:swipe-left'
//   - 'gesture:swipe-right'
//   - 'gesture:motion'  (detail: { vx, vy, mag })  // optional continuous telemetry

export default class GestureDetector {
  constructor({
    mountId = null,             // optional <div> to preview camera
    facingMode = 'user',        // front camera for hand gestures
    minMag = 1.8,               // minimum average flow magnitude to consider movement
    swipeFrac = 0.11,           // fraction of frame width for strong horizontal motion
    debounceMs = 600,           // cooldown between gesture events
    showPreview = true          // append <video> to mount (for debugging)
  } = {}) {
    this.mount = mountId ? document.getElementById(mountId) : null;
    this.facingMode = facingMode;
    this.minMag = minMag;
    this.swipeFrac = swipeFrac;
    this.debounceMs = debounceMs;
    this.showPreview = showPreview;

    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.autoplay = true;
    this.video.muted = true;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.stream = null;
    this._running = false;
    this._raf = null;
    this._lastEmit = 0;

    // CV buffers
    this.prevGray = null;   // cv.Mat (U8 gray)
    this.gray = null;       // cv.Mat
    this.flow = null;       // cv.Mat2f (H x W x 2) if available in OpenCV.js
  }

  async start() {
    await this.#waitForOpenCV();

    // Camera (must be HTTPS/localhost for getUserMedia)
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: this.facingMode },
      audio: false
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    // Buffers
    this.canvas.width = this.video.videoWidth || 640;
    this.canvas.height = this.video.videoHeight || 480;

    this.gray = new cv.Mat(this.canvas.height, this.canvas.width, cv.CV_8UC1);
    this.prevGray = new cv.Mat(this.canvas.height, this.canvas.width, cv.CV_8UC1);

    // Seed prevGray
    this.#grabGray(this.prevGray);

    if (this.showPreview && this.mount && !this.mount.contains(this.video)) {
      this.video.style.maxWidth = '100%';
      this.mount.appendChild(this.video);
    }

    this._running = true;
    this.#tick();
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);

    // Cleanup CV mats
    try { this.gray?.delete?.(); } catch {}
    try { this.prevGray?.delete?.(); } catch {}
    try { this.flow?.delete?.(); } catch {}

    // Stop camera
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  // --- internal ---

  #tick = () => {
    if (!this._running) return;

    // Read current gray frame
    this.#grabGray(this.gray);

    // Compute dense optical flow (Farnebäck)
    // Parameters are tuned for hand swipes at arm's length on mobile
    this.flow?.delete?.();
    this.flow = new cv.Mat();
    cv.calcOpticalFlowFarneback(
      this.prevGray, this.gray, this.flow,
      0.5,    // pyrScale
      3,      // levels
      15,     // winsize
      3,      // iterations
      5,      // polyN
      1.1,    // polySigma
      0       // flags
    );

    // Average flow over a central ROI to reduce edge noise
    const { vx, vy, mag } = this.#averageFlow(this.flow, 0.2, 0.2, 0.6, 0.6);

    // Optional telemetry
    window.dispatchEvent(new CustomEvent('gesture:motion', { detail: { vx, vy, mag } }));

    // Gesture logic
    const now = performance.now();
    const cooldown = (now - this._lastEmit) < this.debounceMs;
    const width = this.canvas.width;

    // Require some minimum motion magnitude
    if (mag > this.minMag && !cooldown) {
      // Horizontal dominance: check vx against a fraction of frame width/time proxy
      const horizStrong = Math.abs(vx) > (this.swipeFrac * width * 0.5);
      if (horizStrong) {
        if (vx > 0) {
          window.dispatchEvent(new Event('gesture:swipe-right'));
        } else {
          window.dispatchEvent(new Event('gesture:swipe-left'));
        }
        this._lastEmit = now;
      }
    }

    // Roll: gray -> prevGray
    this.gray.copyTo(this.prevGray);

    this._raf = requestAnimationFrame(this.#tick);
  };

  #grabGray(dstMat) {
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    const rgba = cv.imread(this.canvas);         // CV_8UC4
    cv.cvtColor(rgba, dstMat, cv.COLOR_RGBA2GRAY);
    rgba.delete();
    // light denoise for robustness
    cv.GaussianBlur(dstMat, dstMat, new cv.Size(5,5), 0);
  }

  #averageFlow(flow, rx, ry, rw, rh) {
    // flow is HxW with 2 channels (x,y). We average over a central ROI.
    const W = flow.cols, H = flow.rows;
    const x0 = Math.floor(W * rx), y0 = Math.floor(H * ry);
    const x1 = Math.floor(W * (rx + rw)), y1 = Math.floor(H * (ry + rh));

    let sumx = 0, sumy = 0, count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const fx = flow.floatAt(y, x * 2);       // channel 0
        const fy = flow.floatAt(y, x * 2 + 1);   // channel 1
        sumx += fx; sumy += fy; count++;
      }
    }
    const vx = sumx / Math.max(1, count);
    const vy = sumy / Math.max(1, count);
    const mag = Math.hypot(vx, vy);
    return { vx, vy, mag };
  }

  #waitForOpenCV() {
    return new Promise((resolve) => {
      const ready = () => (window.cv && cv.Mat) ? resolve() : setTimeout(ready, 30);
      ready();
    });
  }
}
