export default class QRScanner {
  constructor({ mountId = null, facingMode = 'environment', stopAfterHit = true } = {}) {
    this.mount = mountId ? document.getElementById(mountId) : null;
    this.video = document.createElement('video');
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    this.video.autoplay = true;

    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });

    this.facingMode = facingMode;
    this.stopAfterHit = stopAfterHit;

    this.stream = null;
    this._running = false;
    this._raf = null;

    this.detector = null;
  }

  async start() {
    await this.#waitForOpenCV();

    // Camera
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: this.facingMode },
      audio: false
    });
    this.video.srcObject = this.stream;
    await this.video.play();

    // Size buffers
    this.canvas.width = this.video.videoWidth || 640;
    this.canvas.height = this.video.videoHeight || 480;

    // OpenCV QR detector
    this.detector = new cv.QRCodeDetector();

    // Optional: mount preview
    if (this.mount && !this.mount.contains(this.video)) this.mount.appendChild(this.video);

    this._running = true;
    this.#tick();
  }

  stop() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.detector) {
      this.detector.delete();
      this.detector = null;
    }
  }

  #tick = () => {
    if (!this._running) return;

    // Draw current frame to canvas
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
    const frame = cv.imread(this.canvas); // RGBA

    try {
      // You can pass color or grayscale; QRCodeDetector accepts both.
      const points = new cv.Mat();      // 4x1xCV_32FC2 corners
      const straight = new cv.Mat();    // rectified QR (optional)
      const decoded = this.detector.detectAndDecode(frame, points, straight); // "" if none

      if (decoded && decoded.trim().length) {
        const corners = [];
        if (!points.empty()) {
          for (let i = 0; i < points.rows; i++) {
            const x = points.floatAt(i, 0);
            const y = points.floatAt(i, 1);
            corners.push({ x, y });
          }
        }
        window.dispatchEvent(new CustomEvent('qr:found', { detail: { text: decoded, corners } }));
        if (this.stopAfterHit) this.stop();
      }

      points.delete(); straight.delete();
    } finally {
      frame.delete();
    }

    this._raf = requestAnimationFrame(this.#tick);
  };

  #waitForOpenCV() {
    return new Promise((resolve) => {
      const ready = () => (window.cv && cv.Mat) ? resolve() : setTimeout(ready, 30);
      ready();
    });
  }
}