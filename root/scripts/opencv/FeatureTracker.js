// scripts/opencv/FeatureTracker.js
// Reusable sparse feature tracker using OpenCV.js.
// - Detects corners with goodFeaturesToTrack
// - Tracks them with calcOpticalFlowPyrLK
// - Auto-reseeds when tracks fall below a threshold
// Used by AREnvironmentTracker or any motion/gesture module.

export default class FeatureTracker {
  constructor({
    maxCorners = 400,
    qualityLevel = 0.01,
    minDistance = 8,
    reseedThreshold = 120,  // if tracked points < this → reseed
    detectInterval = 10     // also reseed every N calls (safety)
  } = {}) {
    this.maxCorners = maxCorners;
    this.qualityLevel = qualityLevel;
    this.minDistance = minDistance;
    this.reseedThreshold = reseedThreshold;
    this.detectInterval = detectInterval;

    this.prevGray = null;   // cv.Mat (previous grayscale frame)
    this.prevPts = null;    // cv.Mat (Nx1, CV_32FC2) previous feature points

    this._frameCount = 0;
    this._ready = false;
  }

  async waitForOpenCV() {
    if (this._ready) return;
    await new Promise(resolve => {
      const check = () => (window.cv && cv.Mat) ? resolve() : setTimeout(check, 30);
      check();
    });
    this._ready = true;
  }

  /**
   * Reset all internal state (e.g. on camera restart).
   */
  reset() {
    this._release(this.prevGray);
    this._release(this.prevPts);
    this.prevGray = null;
    this.prevPts = null;
    this._frameCount = 0;
  }

  /**
   * Main entry:
   *  - gray: current grayscale cv.Mat
   *  - returns { src, dst } arrays of matched point coordinates in JS (for your motion model),
   *    or null if not enough data this frame.
   */
  update(gray) {
    if (!gray || gray.empty()) return null;
    this._frameCount++;

    // 1) First frame or no previous points → detect corners only
    if (!this.prevGray || !this.prevPts || this.prevPts.rows === 0) {
      this._seedFeatures(gray);
      return null; // need next frame to compute motion
    }

    // 2) Track existing points with Lucas–Kanade optical flow
    const nextPts = new cv.Mat();
    const status  = new cv.Mat();
    const err     = new cv.Mat();
    const winSize = new cv.Size(21, 21);
    const maxLevel = 3;
    const term = new cv.TermCriteria(
      cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT,
      30,
      0.01
    );

    cv.calcOpticalFlowPyrLK(
      this.prevGray,
      gray,
      this.prevPts,
      nextPts,
      status,
      err,
      winSize,
      maxLevel,
      term,
      0,
      0.0001
    );

    // 3) Collect good matches
    const src = [];
    const dst = [];
    for (let i = 0; i < status.rows; i++) {
      if (status.ucharPtr(i, 0)[0] === 1) {
        const x0 = this.prevPts.data32F[i * 2];
        const y0 = this.prevPts.data32F[i * 2 + 1];
        const x1 = nextPts.data32F[i * 2];
        const y1 = nextPts.data32F[i * 2 + 1];
        src.push(x0, y0);
        dst.push(x1, y1);
      }
    }

    // 4) Decide whether to reseed
    const needReseed =
      src.length / 2 < this.reseedThreshold ||
      (this._frameCount % this.detectInterval === 0);

    // 5) Roll state forward
    this._release(this.prevGray);
    this.prevGray = gray.clone();

    this._release(this.prevPts);
    this.prevPts = needReseed
      ? this._seedFeatures(gray)
      : nextPts; // keep tracking from the last positions

    status.delete();
    err.delete();
    if (needReseed && nextPts) nextPts.delete(); // we didn't keep it

    if (src.length / 2 < 8) {
      // not enough for a stable model (affine/homography), let caller skip this frame
      return null;
    }

    return { src, dst };
  }

  /**
   * Detects new feature points in the given gray frame and stores them in prevPts.
   */
  _seedFeatures(gray) {
    const corners = new cv.Mat();
    const mask = new cv.Mat();

    cv.goodFeaturesToTrack(
      gray,
      corners,
      this.maxCorners,
      this.qualityLevel,
      this.minDistance,
      mask,
      3,       // blockSize
      false,   // useHarrisDetector
      0.04
    );

    const pts = new cv.Mat(corners.rows, 1, cv.CV_32FC2);
    for (let i = 0; i < corners.rows; i++) {
      const x = corners.data32F[i * 2];
      const y = corners.data32F[i * 2 + 1];
      pts.data32F[i * 2] = x;
      pts.data32F[i * 2 + 1] = y;
    }

    this._release(this.prevPts);
    this.prevPts = pts;

    corners.delete();
    mask.delete();

    return pts;
  }

  _release(mat) {
    if (mat && typeof mat.delete === 'function') {
      try { mat.delete(); } catch (_) {}
    }
  }
}
