import { CVManager } from './opencv/CVManager.js';


export default class AREnvironmentTracker {
    constructor(THREE, scene, width = 640, height = 480) {
        this.THREE = THREE;
        this.scene = scene;
        this.cvManager = new CVManager(width, height);
        this.isTracking = false;

        // tracking buffers
        this.prevGray = null;
        this.prevPts = null;
        this.pixelToWorldScale = 1 / 1200;
        this.smoothAlpha = 0.25;
        this._ema = new this.THREE.Vector3(0, 0, 0);
    }

    async initialize() {
        await this.cvManager.initialize();
        this.isTracking = true;
        this.track();
    }

    track() {
        if (!this.isTracking) return;

        const frame = this.cvManager.processFrame();
        if (frame && frame.gray) {
            const move = this.calculateMovement(frame.gray, frame.width, frame.height);
            this.updateARPosition(move);
        }
        requestAnimationFrame(() => this.track());
    }

    updateARPosition(movement) {
        if (!movement) return;
        // Exponential-moving-average smoothing
        this._ema.multiplyScalar(1 - this.smoothAlpha);
        this._ema.addScaledVector(movement, this.smoothAlpha);
        this.scene.position.add(this._ema);
    }

    calculateMovement(gray, width, height) {
        // seed first frame
        if (!this.prevGray || !this.prevPts) {
            this.prevGray?.delete?.();
            this.prevGray = gray.clone();
            this.prevPts = new cv.Mat();
            cv.goodFeaturesToTrack(
                gray,
                this.prevPts,
                400,
                0.01,
                8,
                new cv.Mat(),
                3,
                false,
                0.04
            );
            return new this.THREE.Vector3(0, 0, 0);
        }

        // Optical flow
        const nextPts = new cv.Mat();
        const status = new cv.Mat();
        const err = new cv.Mat();
        const win = new cv.Size(21, 21);
        const term = new cv.TermCriteria(cv.TERM_CRITERIA_EPS | cv.TERM_CRITERIA_COUNT, 30, 0.01);

        cv.calcOpticalFlowPyrLK(this.prevGray, gray, this.prevPts, nextPts, status, err, win, 3, term, 0, 0.0001);

        // collect good pairs
        const src = [], dst = [];
        for (let i = 0; i < status.rows; i++) {
            if (status.ucharPtr(i, 0)[0] === 1) {
                src.push(this.prevPts.data32F[i * 2], this.prevPts.data32F[i * 2 + 1]);
                dst.push(nextPts.data32F[i * 2], nextPts.data32F[i * 2 + 1]);
            }
        }

        let movement = new this.THREE.Vector3(0, 0, 0);
        if (src.length >= 8 * 2) {
            const srcMat = cv.matFromArray(src.length / 2, 1, cv.CV_32FC2, new Float32Array(src));
            const dstMat = cv.matFromArray(dst.length / 2, 1, cv.CV_32FC2, new Float32Array(dst));
            const inliers = new cv.Mat();
            const affine = cv.estimateAffine2D(srcMat, dstMat, inliers, cv.RANSAC);

            if (!affine.empty()) {
                const tx = affine.doubleAt(0, 2);
                const ty = affine.doubleAt(1, 2);
                const scale = this.pixelToWorldScale;
                movement = new this.THREE.Vector3(-tx * scale, ty * scale, 0);
            }

            srcMat.delete(); dstMat.delete(); inliers.delete(); affine.delete();
        }

        // roll buffers
        this.prevGray.delete();
        this.prevGray = gray.clone();
        this.prevPts.delete();
        this.prevPts = nextPts;

        status.delete(); err.delete();
        return movement;
    }

    cleanup() {
        this.isTracking = false;
        this.prevGray?.delete?.();
        this.prevPts?.delete?.();
        this.cvManager.cleanup();
    }
}
